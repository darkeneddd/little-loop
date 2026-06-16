"""Seed the database with 15 demo garments, their passport-cycle history,
and rewards, plus a QR code PNG per garment.

Run with the venv's python:
    backend/venv/Scripts/python.exe backend/seed.py

Re-running this script wipes and re-creates all rows (idempotent for demo
purposes) -- run it any time you want to reset the demo to a known-clean
state (before a demo, after poking at the data while testing, etc). Garment
ids are random UUIDs regenerated every run, so every previously written QR
PNG is stale the moment a reseed happens; main() clears static/qr/ first so
it never accumulates orphaned PNGs pointing at ids that no longer exist.
"""

import datetime
import os
import shutil

import qrcode

import models
from constants import CO2_AVOIDED_PER_CYCLE_KG, WATER_SAVED_PER_CYCLE_LITERS
from database import Base, SessionLocal, engine

QR_DIR = os.path.join(os.path.dirname(__file__), "static", "qr")

# Stable, verified Unsplash CDN photo URLs (no API key needed for hotlinking).
THUMB_PARAMS = "?w=600&q=80&fit=crop&auto=format"
THUMBS = [
    f"https://images.unsplash.com/photo-1622290319146-7b63df48a635{THUMB_PARAMS}",
    f"https://images.unsplash.com/photo-1617210251994-8ded7981d27a{THUMB_PARAMS}",
    f"https://images.unsplash.com/photo-1620354600301-e8b325ef1181{THUMB_PARAMS}",
    f"https://images.unsplash.com/photo-1620354600208-d08376012c6b{THUMB_PARAMS}",
    f"https://images.unsplash.com/photo-1552511762-898bfd9fb837{THUMB_PARAMS}",
    f"https://images.unsplash.com/photo-1587116215900-bb2bba7c7cff{THUMB_PARAMS}",
    f"https://images.unsplash.com/photo-1620354599715-a42fe76d85cb{THUMB_PARAMS}",
    f"https://images.unsplash.com/photo-1542355581-caf7454785ca{THUMB_PARAMS}",
    f"https://images.unsplash.com/photo-1549069786-641f4cb652c7{THUMB_PARAMS}",
    f"https://images.unsplash.com/photo-1674883370178-41a0a147c76d{THUMB_PARAMS}",
    f"https://images.unsplash.com/photo-1583007109931-cdf68cdc4f4d{THUMB_PARAMS}",
    f"https://images.unsplash.com/photo-1606946185142-7b30e9a7abcc{THUMB_PARAMS}",
    f"https://images.unsplash.com/photo-1645458456929-43ba80e6bf18{THUMB_PARAMS}",
    f"https://images.unsplash.com/photo-1645458456724-8a8369240119{THUMB_PARAMS}",
    f"https://images.unsplash.com/photo-1675833366391-582bb70c347c{THUMB_PARAMS}",
]

NOW = datetime.datetime(2026, 6, 16, 12, 0, 0)


def days_ago(n):
    return NOW - datetime.timedelta(days=n)


# Each entry: (product_name, size, manufactured_days_ago, category)
# category drives which event timeline + status gets built below.
GARMENT_DEFS = [
    ("Organic Cotton Onesie", "Newborn", 60, "active"),
    ("Snap-Front Bodysuit", "0-3M", 75, "active"),
    ("Ribbed Cotton Onesie", "3-6M", 90, "active"),
    ("Short-Sleeve Bodysuit", "0-3M", 50, "active"),
    ("Classic White Onesie", "Newborn", 40, "active"),
    ("Pink Footed Onesie", "3-6M", 220, "resale"),
    ("Long-Sleeve Onesie", "6-9M", 240, "resale"),
    ("Baby Sock Set (3-Pack)", "0-3M", 200, "resale"),
    ("Knit Grey Dress", "6-9M", 260, "resale"),
    ("Red Knit Sweater & Hat Set", "9-12M", 230, "resale"),
    ("Bear-Themed Romper", "12-18M", 150, "returned"),
    ("Quilted Winter Jacket", "18-24M", 160, "returned"),
    ("Lightweight Zip Jacket", "2T", 140, "returned"),
    ("Hooded Rain Jacket", "2T", 300, "rejected"),
    ("Puffer Snowsuit", "3T", 320, "rejected"),
]


def build_garment(idx, defn, thumbnail_url, db):
    product_name, size, manuf_days_ago, category = defn
    sku = f"LL-{idx:03d}"
    manufactured_at = days_ago(manuf_days_ago)

    garment = models.Garment(
        sku=sku,
        product_name=product_name,
        size=size,
        manufactured_at=manufactured_at,
        thumbnail_url=thumbnail_url,
    )

    cycles = []
    rewards = []

    # cycle_number is a simple ordinal counter over this garment's events.
    cn = 1

    def add_cycle(event_type, offset_days_before_now, condition_score=None, notes=None):
        nonlocal cn
        cyc = models.PassportCycle(
            cycle_number=cn,
            event_type=event_type,
            timestamp=days_ago(offset_days_before_now),
            condition_score_at_event=condition_score,
            notes=notes,
        )
        cycles.append(cyc)
        cn += 1
        return cyc

    if category == "active":
        # First life, still with original family, lightly worn.
        condition = 96 - idx  # 90-95ish, varies per garment
        add_cycle("manufactured", manuf_days_ago)
        add_cycle("purchased", manuf_days_ago - 5)
        garment.current_status = "active"
        garment.current_condition_score = condition
        garment.price = None

    elif category == "resale":
        # Completed one full loop: manufactured -> purchased -> returned ->
        # inspected/sanitized, now listed for a new family.
        condition = 78 + (idx % 5) * 3  # 78-90ish, "excellent" to "good"
        add_cycle("manufactured", manuf_days_ago)
        add_cycle("purchased", manuf_days_ago - 10)
        add_cycle("returned", manuf_days_ago - 120)
        inspect_days = manuf_days_ago - 122
        add_cycle(
            "inspected",
            inspect_days,
            condition_score=condition,
            notes="AI assessment: good condition, minor pilling, approved for trade-in.",
        )
        sanitize_days = manuf_days_ago - 124
        add_cycle("sanitized", sanitize_days, condition_score=condition)

        garment.current_status = "resale"
        garment.current_condition_score = condition
        garment.price = round(2.0 + condition * 0.08, 2)

        reward = models.Reward(
            reward_type="store_credit",
            value=round(condition * 0.10, 2),
            issued_at=days_ago(inspect_days),
        )
        rewards.append((reward, 3))  # attach to the "inspected" cycle (index 3, 0-based)

    elif category == "returned":
        # Just handed back by the parent; awaiting employee inspection.
        condition = 70 + (idx % 4) * 5
        add_cycle("manufactured", manuf_days_ago)
        add_cycle("purchased", manuf_days_ago - 8)
        add_cycle(
            "returned",
            5,
            condition_score=condition,
            notes="Trade-in submitted, awaiting AI inspection.",
        )
        garment.current_status = "returned"
        garment.current_condition_score = condition
        garment.price = None

    elif category == "rejected":
        # Trade-in was inspected and rejected for poor condition; per the
        # rejection flow, garment goes back to the parent (no reward issued).
        condition = 15 + (idx % 3) * 5  # 15-25, clearly "rejected" grade
        add_cycle("manufactured", manuf_days_ago)
        add_cycle("purchased", manuf_days_ago - 8)
        add_cycle("returned", 10)
        add_cycle(
            "inspected",
            8,
            condition_score=condition,
            notes="AI assessment: heavy staining and torn seams. Trade-in rejected; returned to family.",
        )
        garment.current_status = "returned"
        garment.current_condition_score = condition
        garment.price = None

    garment.cycles = cycles
    return garment, rewards


def main():
    # Fresh tables every run.
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    # Fresh QR directory too -- old PNGs are keyed by ids this run just
    # dropped, so leaving them in place would only accumulate orphans.
    shutil.rmtree(QR_DIR, ignore_errors=True)
    os.makedirs(QR_DIR, exist_ok=True)

    db = SessionLocal()
    try:
        for idx, defn in enumerate(GARMENT_DEFS, start=1):
            thumb = THUMBS[(idx - 1) % len(THUMBS)]
            garment, pending_rewards = build_garment(idx, defn, thumb, db)
            db.add(garment)
            db.flush()  # assign garment.id and cycle ids

            for reward, cycle_index in pending_rewards:
                reward.garment_id = garment.id
                reward.cycle_id = garment.cycles[cycle_index].id
                db.add(reward)

            # QR code encodes the garment id -- the Passport Scanner screen
            # looks this up directly via GET /garments/:id.
            img = qrcode.make(garment.id)
            img.save(os.path.join(QR_DIR, f"{garment.id}.png"))

        db.commit()
        count = db.query(models.Garment).count()
        cycle_count = db.query(models.PassportCycle).count()
        reward_count = db.query(models.Reward).count()
        print(
            f"Seeded {count} garments, {cycle_count} passport cycles, "
            f"{reward_count} rewards. QR codes written to {QR_DIR}"
        )
        print(
            f"Sustainability proxies: {WATER_SAVED_PER_CYCLE_LITERS}L water / "
            f"{CO2_AVOIDED_PER_CYCLE_KG}kg CO2 per cycle."
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
