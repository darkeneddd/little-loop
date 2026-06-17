"""Mock Claude vision garment assessor, plus the tiered /assess cascade.

`assess_garment_image` is a deterministic mock -- final fallback tier if both
the finetuned model (inference.py) and Claude Haiku (claude_assess.py) are
unavailable. `run_assessment` is what POST /assess actually calls; it tries
each tier in order and returns the first one that succeeds.

Deterministic on the input image (via a hash of the base64 string) so the
mock tier always produces the same result for the same photo across demo
runs, rather than flickering between "Excellent" and "Rejected" on every
retry.
"""

import base64
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
        "assessed_by": "deterministic_mock",
    }


def run_assessment(image_base64):
    """Tiered cascade behind POST /assess: finetuned model -> Claude Haiku
    vision -> deterministic mock, each only used if the one above it isn't
    usable. `import inference` / `import claude_assess` happen here (not at
    module top) so that a machine without torch/transformers installed gets
    an ImportError caught right here, falling through to Claude, instead of
    crashing the whole server at startup."""
    image_bytes = base64.b64decode(image_base64)

    try:
        import inference
        return inference.run_inference(image_bytes)
    except Exception as e:
        print(f"[assess] finetuned model unavailable, falling back to Claude: {e}")

    try:
        import claude_assess
        return claude_assess.run_inference(image_bytes)
    except Exception as e:
        print(f"[assess] Claude fallback unavailable, using deterministic mock: {e}")

    return assess_garment_image(image_base64)
