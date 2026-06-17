"""Tier 2 of POST /assess's fallback cascade -- Claude Haiku 4.5 vision.

Used when the finetuned model (inference.py) is unavailable (missing
checkpoint, ML deps not installed, or any inference error). Prompts Claude to
score the same four wear-and-tear categories the finetuned model uses, on the
same 1-5 severity scale, so defect_scoring.score() produces a comparable
condition_score regardless of which tier ran.

No torch/Pillow dependency -- this tier must keep working even on a machine
that hasn't installed the optional ML stack (see MODEL_INTEGRATION.md).
"""

import base64
import json
import os

from anthropic import Anthropic

from assessment import (
    grade_for_score,
    PRICE_BASE,
    PRICE_PER_CONDITION_POINT,
    TRADE_IN_ELIGIBLE_MIN_SCORE,
)
from defect_scoring import score, defects_to_labels

MODEL = "claude-haiku-4-5"

SYSTEM_PROMPT = """You are inspecting a single photo of a used baby garment \
submitted for a trade-in program. Rate each of these four attributes on a \
1-5 severity scale, where 1 means no issue and 5 means severe:

- pilling: fuzzy/fabric balling from wear
- condition: overall fabric wear and fading
- stains: visible stains or discoloration
- holes: tears, rips, or holes

Respond with ONLY a JSON object in this exact shape, no other text:
{"pilling": <1-5>, "condition": <1-5>, "stains": <1-5>, "holes": <1-5>}"""


def _sniff_media_type(image_bytes):
    """Detect image media type from magic bytes -- avoids a Pillow dependency
    so this tier works without the optional ML deps installed. The frontend
    sends bare base64 with no mime type, so this is the only way to get the
    right media_type for Claude's vision API."""
    if image_bytes[:2] == b"\xff\xd8":
        return "image/jpeg"
    if image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if image_bytes[:4] == b"GIF8":
        return "image/gif"
    if image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP":
        return "image/webp"
    return "image/jpeg"  # most likely default for camera/phone uploads


def run_inference(image_bytes):
    """Run the Claude Haiku vision fallback on an in-memory photo and return
    the same contract shape every tier returns. Raises if ANTHROPIC_API_KEY
    is unset or the API call/response parsing fails; the caller
    (assessment.run_assessment) falls back to the deterministic mock on any
    exception."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")

    client = Anthropic(api_key=api_key)
    image_base64 = base64.b64encode(image_bytes).decode("utf-8")
    media_type = _sniff_media_type(image_bytes)

    response = client.messages.create(
        model=MODEL,
        max_tokens=200,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": image_base64,
                    },
                },
                {"type": "text", "text": "Assess this garment."},
            ],
        }],
    )

    text = next(block.text for block in response.content if block.type == "text")
    raw_defects = json.loads(text)
    defects = {k: int(v) for k, v in raw_defects.items()}

    # AssessmentResult.condition_score is an int (matches the DB's Integer
    # columns and the deterministic mock's int score) -- score() returns a
    # float since the weights produce quarter-point increments.
    condition_score = round(score(defects))

    return {
        "condition_score": condition_score,
        "grade": grade_for_score(condition_score),
        "defects": defects_to_labels(defects),
        "recommended_price": round(PRICE_BASE + condition_score * PRICE_PER_CONDITION_POINT, 2),
        "eligible_for_trade_in": condition_score >= TRADE_IN_ELIGIBLE_MIN_SCORE,
        "assessed_by": "claude_fallback",
    }
