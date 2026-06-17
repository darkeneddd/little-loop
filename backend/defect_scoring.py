"""Shared scoring logic for both AI assessment tiers (inference.py and
claude_assess.py). Deliberately has zero torch/transformers dependency so the
Claude fallback tier stays usable even on a machine without the ML deps
installed -- importing this module must never pull in torch.
"""

# Severity wording is a placeholder until checkpoint outputs can be eyeballed
# against real photos (see MODEL_INTEGRATION.md) -- only attach a label once
# severity reaches "moderate" so mild wear doesn't show a badge.
SEVERITY_LABELS = {3: "moderate", 4: "significant", 5: "severe"}


def score(defects):
    """
    Deterministic scoring formula shared by every model-backed tier.
    Returns a 0-100 score where higher = better condition.
    """
    weights = {
        "condition": 0.40,
        "holes": 0.25,
        "stains": 0.20,
        "pilling": 0.15,
    }
    # Flip scale: score 1 (no defect) -> best, score 5 (severe) -> worst
    # (6 - score) maps 1->5, 5->1, then normalize to 0-1 by dividing by 4
    weighted_sum = sum(
        weights[k] * (6 - defects[k]) / 4.0
        for k in weights
    )
    return round(weighted_sum * 100, 1)


def defects_to_labels(defects):
    """Map a {pilling, condition, stains, holes: 1-5} dict to human-readable
    defect strings (e.g. "moderate stains") for the Trade-In UI's badges."""
    return [
        f"{SEVERITY_LABELS[severity]} {name}"
        for name, severity in defects.items()
        if severity >= 3
    ]
