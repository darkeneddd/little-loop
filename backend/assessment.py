"""Mock Claude vision garment assessor.

Stands in for a real call to the Claude API (vision) for the hackathon demo.
`assess_garment_image` is deliberately the only public surface here -- when a
real API key is wired up, swap its body for an actual
`client.messages.create(...)` call that prompts Claude to return the same
JSON shape. Callers (POST /assess in main.py) never need to change.

Deterministic on the input image (via a hash of the base64 string) so the
same photo always produces the same result across demo runs, rather than
flickering between "Excellent" and "Rejected" on every retry.
"""

import hashlib

# (score_floor, grade) pairs, checked high to low.
GRADE_BANDS = [
    (90, "Excellent"),
    (75, "Good"),
    (60, "Fair"),
    (40, "Poor"),
    (0, "Rejected"),
]

DEFECT_POOL = {
    "Excellent": [],
    "Good": ["minor pilling"],
    "Fair": ["small stain", "loose thread"],
    "Poor": ["faded color", "stretched fabric", "missing button"],
    "Rejected": ["heavy staining", "torn seam", "broken zipper"],
}

# Mirrors seed.py's resale pricing formula so mock-assessed and seeded
# garments land in the same price range.
PRICE_BASE = 2.0
PRICE_PER_CONDITION_POINT = 0.08

TRADE_IN_ELIGIBLE_MIN_SCORE = 50


def grade_for_score(score):
    for floor, grade in GRADE_BANDS:
        if score >= floor:
            return grade
    return "Rejected"


def _score_from_image(image_base64):
    digest = hashlib.sha256(image_base64.encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % 100


def assess_garment_image(image_base64):
    """Run a (mock) condition assessment on a base64-encoded garment photo.

    Returns the structured dict the API contract promises:
    condition_score, grade, defects, recommended_price, eligible_for_trade_in.
    """
    score = _score_from_image(image_base64)
    grade = grade_for_score(score)
    defects = DEFECT_POOL[grade]
    recommended_price = round(PRICE_BASE + score * PRICE_PER_CONDITION_POINT, 2)
    eligible_for_trade_in = score >= TRADE_IN_ELIGIBLE_MIN_SCORE

    return {
        "condition_score": score,
        "grade": grade,
        "defects": defects,
        "recommended_price": recommended_price,
        "eligible_for_trade_in": eligible_for_trade_in,
    }
