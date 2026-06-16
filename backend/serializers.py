"""Shared response-shaping helpers for the API routes.

Kept separate from main.py so dashboard aggregates (T08) can reuse the same
sustainability math as the single-garment passport (T04) without duplicating
the formula.
"""

from constants import CO2_AVOIDED_PER_CYCLE_KG, WATER_SAVED_PER_CYCLE_LITERS

# A "completed cycle" is counted at the "sanitized" event -- that's the point
# in the timeline where a garment has been inspected, approved, cleaned, and
# is ready to re-enter circulation for a new family. Garments still active
# with their first family, or awaiting/failing inspection, haven't earned the
# sustainability credit yet.
COMPLETING_EVENT_TYPE = "sanitized"


def serialize_reward(reward):
    return {
        "id": reward.id,
        "reward_type": reward.reward_type,
        "value": reward.value,
        "issued_at": reward.issued_at.isoformat(),
    }


def serialize_cycle(cycle):
    return {
        "id": cycle.id,
        "cycle_number": cycle.cycle_number,
        "event_type": cycle.event_type,
        "timestamp": cycle.timestamp.isoformat(),
        "condition_score_at_event": cycle.condition_score_at_event,
        "notes": cycle.notes,
        "rewards": [serialize_reward(r) for r in cycle.rewards],
    }


def count_completed_cycles(cycles):
    return sum(1 for c in cycles if c.event_type == COMPLETING_EVENT_TYPE)


def compute_sustainability_totals(cycles):
    completed = count_completed_cycles(cycles)
    return {
        "cycles_completed": completed,
        "water_saved_liters": completed * WATER_SAVED_PER_CYCLE_LITERS,
        "co2_avoided_kg": round(completed * CO2_AVOIDED_PER_CYCLE_KG, 2),
    }


def serialize_garment(garment, include_cycles=True):
    data = {
        "id": garment.id,
        "sku": garment.sku,
        "product_name": garment.product_name,
        "size": garment.size,
        "manufactured_at": garment.manufactured_at.isoformat(),
        "current_condition_score": garment.current_condition_score,
        "current_status": garment.current_status,
        "price": garment.price,
        "thumbnail_url": garment.thumbnail_url,
    }
    if include_cycles:
        data["cycles"] = [serialize_cycle(c) for c in garment.cycles]
        data["sustainability"] = compute_sustainability_totals(garment.cycles)
    return data
