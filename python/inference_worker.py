"""
PyTorch inference worker for the Water Turbidity Classifier.

This script is spawned as a long-running child process by the TypeScript
server. It loads the ResNet-34 model once at startup, then reads JSON
requests from stdin and writes JSON responses to stdout (one per line).

Protocol (JSON Lines over stdio):
  → stdin:  {"id": "req-1", "image_base64": "..."}
  ← stdout: {"id": "req-1", "class": "cloudy", "confidence": 0.87, ...}
  ← stdout: {"id": "req-1", "error": "some error message"}

The READY signal is sent once on startup:
  ← stdout: {"ready": true, "device": "cpu"}
"""

import sys
import os
import io
import json
import base64
import traceback

import numpy as np
from PIL import Image, ImageOps
import torch
import torch.nn as nn
from torchvision import transforms, models


# ─────────── Config ───────────

CLASSES = [
    "ultra cloudy",
    "very cloudy",
    "cloudy",
    "lightly cloudy",
    "lightly clear",
    "clear",
]

TURBIDITY_RANGES = {
    "ultra cloudy":   {"min": 3336.0, "max": 3844.0},
    "very cloudy":    {"min": 1300.0, "max": 2520.0},
    "cloudy":         {"min": 600.0,  "max": 1200.0},
    "lightly cloudy": {"min": 150.0,  "max": 450.0},
    "lightly clear":  {"min": 25.0,   "max": 90.0},
    "clear":          {"min": 1.47,   "max": 17.13},
}


# ─────────── Preprocessing (identical to original app.py) ───────────

def gray_world(img: Image.Image) -> Image.Image:
    """Apply gray-world white balance correction."""
    arr = np.asarray(img).astype(np.float32)
    if arr.ndim == 2:
        arr = np.stack([arr] * 3, axis=-1)
    mean = arr.reshape(-1, 3).mean(0) + 1e-6
    arr *= mean.mean() / mean
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


preprocess = transforms.Compose([
    transforms.Lambda(lambda im: ImageOps.exif_transpose(im)),
    transforms.Lambda(gray_world),
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


# ─────────── Model (identical to original app.py) ───────────

def build_model(num_classes: int = len(CLASSES)) -> nn.Module:
    """Build ResNet-34 with custom classification head."""
    try:
        m = models.resnet34(weights=models.ResNet34_Weights.IMAGENET1K_V1)
    except Exception:
        m = models.resnet34(pretrained=True)
    in_f = m.fc.in_features
    m.fc = nn.Sequential(
        nn.Dropout(0.5),
        nn.Linear(in_f, 512),
        nn.ReLU(True),
        nn.Dropout(0.5),
        nn.Linear(512, num_classes),
    )
    return m


def load_model(model_path: str) -> tuple[nn.Module | None, torch.device]:
    """Load the trained model weights. Returns (model, device)."""
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    if not os.path.exists(model_path):
        return None, device

    model = build_model(num_classes=len(CLASSES)).to(device)
    state = torch.load(model_path, map_location=device)

    if isinstance(state, dict) and "state_dict" in state:
        state = state["state_dict"]

    # Remove 'module.' prefix if present (from DDP training)
    if any(k.startswith("module.") for k in state.keys()):
        state = {k.replace("module.", "", 1): v for k, v in state.items()}

    model.load_state_dict(state, strict=True)
    model.eval()
    return model, device


# ─────────── Inference ───────────

def predict_image(
    model: nn.Module, device: torch.device, image: Image.Image
) -> dict:
    """Run inference on a PIL image. Returns the prediction dict."""
    x = preprocess(image).unsqueeze(0).to(device)
    with torch.no_grad():
        logits = model(x)
        probs = torch.softmax(logits, dim=1).cpu().numpy()[0]

    idx = int(np.argmax(probs))
    return {
        "class": CLASSES[idx],
        "confidence": float(probs[idx]),
        "probabilities": {cls: float(p) for cls, p in zip(CLASSES, probs)},
        "ntu_range": TURBIDITY_RANGES[CLASSES[idx]],
    }


# ─────────── Stdio Protocol ───────────

def send(obj: dict) -> None:
    """Write a JSON line to stdout and flush."""
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def log(msg: str) -> None:
    """Write a log message to stderr (visible in parent's logs)."""
    sys.stderr.write(f"[inference_worker] {msg}\n")
    sys.stderr.flush()


def main() -> None:
    model_path = os.environ.get("MODEL_PATH", "best.pth")
    log(f"Loading model from: {model_path}")

    model, device = load_model(model_path)

    if model is None:
        log(f"WARNING: Model file not found at '{model_path}'")
        send({"ready": True, "model_loaded": False, "device": str(device)})
    else:
        log(f"Model loaded on {device}")
        send({"ready": True, "model_loaded": True, "device": str(device)})

    # Process requests from stdin, one JSON line at a time.
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            req = json.loads(line)
        except json.JSONDecodeError as e:
            send({"error": f"Invalid JSON: {e}"})
            continue

        req_id = req.get("id", "unknown")

        try:
            if model is None:
                send({"id": req_id, "error": "Model not loaded"})
                continue

            # Decode base64 image
            image_b64 = req.get("image_base64", "")
            if not image_b64:
                send({"id": req_id, "error": "No image_base64 provided"})
                continue

            image_bytes = base64.b64decode(image_b64)
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

            # Run prediction
            result = predict_image(model, device, image)
            result["id"] = req_id
            send(result)

        except Exception:
            send({"id": req_id, "error": traceback.format_exc()})

    log("stdin closed — shutting down")


if __name__ == "__main__":
    main()
