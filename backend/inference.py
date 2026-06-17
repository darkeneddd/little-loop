"""
Clothing Defect Inference
=========================
Load trained checkpoint and run on a single image.

Usage:
    python inference.py path/to/image.jpg
"""

import io
import os
import sys
import json
import math
import torch
import torch.nn as nn
from PIL import Image
from torchvision import transforms
from transformers import AutoModel

from assessment import (
    grade_for_score,
    PRICE_BASE,
    PRICE_PER_CONDITION_POINT,
    TRADE_IN_ELIGIBLE_MIN_SCORE,
)
from defect_scoring import score, defects_to_labels


# ─────────────────────────────────────────────
# Must match train.py exactly
# ─────────────────────────────────────────────
# Absolute path so this works regardless of the CWD uvicorn is launched from
# (mirrors main.py's STATIC_DIR pattern).
CHECKPOINT = os.path.join(os.path.dirname(__file__), "checkpoint.pt")
DEVICE     = "cuda" if torch.cuda.is_available() else "cpu"


class DefectHead(nn.Module):
    def __init__(self, in_dim=768, hidden=256, num_classes=5):
        super().__init__()
        self.net = nn.Sequential(
            nn.LayerNorm(in_dim),
            nn.Linear(in_dim, hidden),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(hidden, num_classes),
        )

    def forward(self, x):
        return self.net(x)


class ClothingDefectModel(nn.Module):
    DEFECT_NAMES = ["pilling", "condition", "stains", "holes"]

    def __init__(self):
        super().__init__()
        self.backbone = AutoModel.from_pretrained("facebook/dinov2-base")
        self.heads    = nn.ModuleDict({
            name: DefectHead() for name in self.DEFECT_NAMES
        })

    def forward(self, x):
        outputs = self.backbone(pixel_values=x)
        cls     = outputs.last_hidden_state[:, 0, :]
        return {name: head(cls) for name, head in self.heads.items()}


def load_model(checkpoint_path):
    model = ClothingDefectModel().to(DEVICE)
    ckpt  = torch.load(checkpoint_path, map_location=DEVICE)
    model.load_state_dict(ckpt["model"])
    model.eval()
    print(f"Loaded checkpoint from epoch {ckpt['epoch']} (val MAE: {ckpt['val_mae']:.4f})")
    return model


# Singleton -- FastAPI calls run_inference() once per /assess request, and
# reloading the checkpoint + DINOv2 backbone every time would add
# multi-second latency to every trade-in scan.
_model = None


def get_model():
    global _model
    if _model is None:
        if not os.path.exists(CHECKPOINT):
            raise FileNotFoundError(f"checkpoint not found at {CHECKPOINT}")
        _model = load_model(CHECKPOINT)
    return _model


TRANSFORM = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])


def preprocess_image(img):
    return TRANSFORM(img.convert("RGB")).unsqueeze(0).to(DEVICE)   # add batch dim


def preprocess(image_path):
    return preprocess_image(Image.open(image_path))


def compute_confidence(outputs):
    """
    Confidence = 1 - average normalized entropy across all heads.
    High entropy (uniform distribution) = low confidence.
    """
    entropies = []
    for logits in outputs.values():
        probs   = torch.softmax(logits, dim=-1)
        entropy = -(probs * probs.log()).sum(dim=-1)
        normalized = entropy / math.log(5)   # max entropy for 5 classes
        entropies.append(normalized.item())
    avg_entropy = sum(entropies) / len(entropies)
    return round(1.0 - avg_entropy, 2)


def predict(image_path, model):
    img = preprocess(image_path)
    with torch.no_grad():
        outputs = model(img)

    defects = {
        name: int(logits.argmax(dim=1).item()) + 1   # 0-4 -> 1-5
        for name, logits in outputs.items()
    }
    confidence = compute_confidence(outputs)

    return {
        "defects":    defects,
        "confidence": confidence,
    }


def run_inference(image_bytes):
    """Tier 1 of POST /assess's fallback cascade -- run the finetuned model
    on an in-memory photo and return the same contract shape every tier
    returns (condition_score, grade, defects, recommended_price,
    eligible_for_trade_in). Raises if the checkpoint is missing or any other
    error occurs; the caller (assessment.run_assessment) falls back to the
    next tier on any exception."""
    model = get_model()
    img = Image.open(io.BytesIO(image_bytes))
    tensor = preprocess_image(img)
    with torch.no_grad():
        outputs = model(tensor)

    defects = {
        name: int(logits.argmax(dim=1).item()) + 1   # 0-4 -> 1-5
        for name, logits in outputs.items()
    }
    confidence = compute_confidence(outputs)
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
        "assessed_by": "finetuned_model",
        "confidence": confidence,
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python inference.py <image_path>")
        sys.exit(1)

    image_path = sys.argv[1]
    model      = load_model(CHECKPOINT)
    result     = predict(image_path, model)
    result["score"] = score(result["defects"])

    print(json.dumps(result, indent=2))