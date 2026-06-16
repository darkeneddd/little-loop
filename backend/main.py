import datetime
import os
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from assessment import assess_garment_image
from database import engine, get_db
from serializers import compute_sustainability_totals, count_completed_cycles, serialize_garment

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="LittleLoop API")

# Serves the QR PNGs seed.py writes to static/qr/<garment_id>.png (T15) --
# absolute path so this works regardless of the CWD uvicorn is launched from.
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "LittleLoop API is running"}


@app.get("/garments")
def list_garments(
    size: Optional[str] = None,
    condition_min: Optional[int] = None,
    price_max: Optional[float] = None,
    db: Session = Depends(get_db),
):
    """Resale inventory for the Marketplace screen. Always scoped to
    current_status == "resale"; size / condition_min / price_max narrow
    further when provided."""
    query = db.query(models.Garment).filter(models.Garment.current_status == "resale")
    if size is not None:
        query = query.filter(models.Garment.size == size)
    if condition_min is not None:
        query = query.filter(models.Garment.current_condition_score >= condition_min)
    if price_max is not None:
        query = query.filter(models.Garment.price <= price_max)
    garments = query.all()
    return [serialize_garment(g, include_cycles=False) for g in garments]


@app.get("/garments/{garment_id}")
def get_garment(garment_id: str, db: Session = Depends(get_db)):
    """Full digital garment passport: profile + cycle history + sustainability
    totals. Powers the Passport screen after a QR scan / manual id lookup."""
    garment = db.query(models.Garment).filter(models.Garment.id == garment_id).first()
    if garment is None:
        raise HTTPException(status_code=404, detail="Garment not found")
    return serialize_garment(garment, include_cycles=True)


class AssessRequest(BaseModel):
    image_base64: str


@app.post("/assess")
def assess(payload: AssessRequest):
    """AI condition assessment for the Employee Trade-In screen. Currently a
    deterministic mock (see assessment.py); swap in a real Claude vision call
    there without touching this route."""
    return assess_garment_image(payload.image_base64)


class AssessmentResult(BaseModel):
    """Mirrors the shape POST /assess returns -- the Trade-In screen calls
    /assess first, then resubmits its result here alongside the employee's
    decision rather than this route re-running the assessment itself."""

    condition_score: int
    grade: str
    defects: List[str] = []
    recommended_price: Optional[float] = None
    eligible_for_trade_in: Optional[bool] = None


class TradeInRequest(BaseModel):
    garment_id: str
    assessment_result: AssessmentResult
    employee_decision: str  # "approve" | "reject"
    reason: Optional[str] = None  # only used on reject; defaults to a generic note


@app.post("/trade-in")
def trade_in(payload: TradeInRequest, db: Session = Depends(get_db)):
    """Employee Trade-In decision. Approve folds the inspect + sanitize steps
    into one transaction (mirroring seed.py's "resale" category) and lists the
    garment on the Marketplace; reject logs the reason and hands the garment
    back to the family with no reward. Note: this intentionally sets
    current_status to "resale" on approve (not "returned" as TODO.md's T07
    bullet literally says) so the Marketplace actually receives newly-approved
    garments, consistent with the status lifecycle CLAUDE.md and seed.py
    already establish."""
    garment = db.query(models.Garment).filter(models.Garment.id == payload.garment_id).first()
    if garment is None:
        raise HTTPException(status_code=404, detail="Garment not found")
    if payload.employee_decision not in ("approve", "reject"):
        raise HTTPException(
            status_code=400, detail="employee_decision must be 'approve' or 'reject'"
        )

    score = payload.assessment_result.condition_score
    next_cycle_number = len(garment.cycles) + 1
    now = datetime.datetime.utcnow()

    if payload.employee_decision == "approve":
        inspected = models.PassportCycle(
            garment_id=garment.id,
            cycle_number=next_cycle_number,
            event_type="inspected",
            timestamp=now,
            condition_score_at_event=score,
            notes=f"AI assessment: grade {payload.assessment_result.grade}. Approved for trade-in.",
        )
        db.add(inspected)
        db.flush()  # assign inspected.id for the reward's FK below

        sanitized = models.PassportCycle(
            garment_id=garment.id,
            cycle_number=next_cycle_number + 1,
            event_type="sanitized",
            timestamp=now,
            condition_score_at_event=score,
        )
        db.add(sanitized)

        reward = models.Reward(
            garment_id=garment.id,
            cycle_id=inspected.id,
            reward_type="store_credit",
            value=round(score * 0.10, 2),
            issued_at=now,
        )
        db.add(reward)

        garment.current_status = "resale"
        garment.current_condition_score = score
        garment.price = payload.assessment_result.recommended_price or round(
            2.0 + score * 0.08, 2
        )
    else:
        reason = (
            payload.reason
            or f"AI assessment: grade {payload.assessment_result.grade}. "
            "Trade-in rejected; returned to family."
        )
        inspected = models.PassportCycle(
            garment_id=garment.id,
            cycle_number=next_cycle_number,
            event_type="inspected",
            timestamp=now,
            condition_score_at_event=score,
            notes=reason,
        )
        db.add(inspected)

        garment.current_status = "returned"
        garment.current_condition_score = score
        garment.price = None

    db.commit()
    db.refresh(garment)
    return serialize_garment(garment, include_cycles=True)


@app.post("/garments/{garment_id}/purchase")
def purchase_garment(garment_id: str, db: Session = Depends(get_db)):
    """Marketplace "Purchase" button (T12). No real checkout (per CLAUDE.md) --
    just flips the garment from "resale" back to "active" with a new family
    and logs a "purchased" cycle event, the same event_type seed.py uses for
    original purchases. This is what grows a garment's "families served"
    count on the Passport screen and the dashboard's "resold" metric (a
    garment with >=2 purchased events has gone around the loop)."""
    garment = db.query(models.Garment).filter(models.Garment.id == garment_id).first()
    if garment is None:
        raise HTTPException(status_code=404, detail="Garment not found")
    if garment.current_status != "resale":
        raise HTTPException(status_code=400, detail="Garment is not available for purchase")

    next_cycle_number = len(garment.cycles) + 1
    now = datetime.datetime.utcnow()
    purchased = models.PassportCycle(
        garment_id=garment.id,
        cycle_number=next_cycle_number,
        event_type="purchased",
        timestamp=now,
        condition_score_at_event=garment.current_condition_score,
        notes="Purchased via Marketplace.",
    )
    db.add(purchased)
    garment.current_status = "active"
    db.commit()
    db.refresh(garment)
    return serialize_garment(garment, include_cycles=True)


@app.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    """Aggregated stats for the Corporate Dashboard screen.

    "resold" counts garments that have actually re-entered circulation with a
    second family (>=2 "purchased" events in their history) -- distinct from
    current_status == "resale", which just means *listed*, not yet bought
    again. Expect 0 until the Marketplace "Purchase" flow (T12) is wired up
    and exercised. "Most durable" ranks by completed (sanitized) cycles
    first, current condition score as the tiebreaker -- a garment that's
    survived more trips around the loop is more durable than one that merely
    arrived in great shape once.
    """
    garments = db.query(models.Garment).all()
    all_cycles = db.query(models.PassportCycle).all()

    total_garments = len(garments)
    returned = sum(1 for g in garments if g.current_status == "returned")

    def purchase_count(g):
        return sum(1 for c in g.cycles if c.event_type == "purchased")

    resold = sum(1 for g in garments if purchase_count(g) >= 2)

    # "Participants" = total families the program has served across every
    # garment's history (each "purchased" cycle event is one family taking
    # ownership) -- the same per-garment count Passport.jsx labels "Families
    # served", just summed program-wide.
    participants = sum(purchase_count(g) for g in garments)

    # "Revenue generated" = resale revenue actually collected so far, i.e.
    # the price paid for garments that have gone around the loop at least
    # once (the same set counted in `resold`). purchase_garment() doesn't
    # clear price on purchase, so garment.price still holds what was paid.
    revenue_generated = round(
        sum(g.price or 0 for g in garments if purchase_count(g) >= 2), 2
    )

    def durability_key(g):
        return (count_completed_cycles(g.cycles), g.current_condition_score or 0)

    top_durable = sorted(garments, key=durability_key, reverse=True)[:3]
    top_durable_payload = [
        {
            "id": g.id,
            "sku": g.sku,
            "product_name": g.product_name,
            "size": g.size,
            "current_condition_score": g.current_condition_score,
            "cycles_completed": count_completed_cycles(g.cycles),
        }
        for g in top_durable
    ]

    returns_by_size = {}
    for c in all_cycles:
        if c.event_type == "returned":
            size = c.garment.size
            returns_by_size[size] = returns_by_size.get(size, 0) + 1

    return {
        "total_garments": total_garments,
        "returned": returned,
        "resold": resold,
        "participants": participants,
        "revenue_generated": revenue_generated,
        "sustainability": compute_sustainability_totals(all_cycles),
        "top_durable_garments": top_durable_payload,
        "returns_by_size": returns_by_size,
    }
