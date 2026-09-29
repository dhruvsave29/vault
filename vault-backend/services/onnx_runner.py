import os
import pickle
from pathlib import Path
from typing import Any

import numpy as np
import onnxruntime as ort

MODELS_DIR = Path(__file__).parent.parent / "models"

_model_cache: dict[str, ort.InferenceSession] = {}
_vectorizer_cache: dict[str, Any] = {}

MODEL_CONFIG = {
    "mnist": {
        "onnx_file": "mnist.onnx",
        "input_name": "float_input",
        "input_size": 784,
        "task_type": "classification",
        "labels": [str(i) for i in range(10)],
    },
    "sentiment": {
        "onnx_file": "sentiment.onnx",
        "input_name": "float_input",
        "input_size": 5000,
        "task_type": "sentiment",
        "labels": ["negative", "positive"],
        "vectorizer_file": "sentiment_vectorizer.pkl",
    },
    "summarizer": {
        "onnx_file": "summarizer.onnx",
        "input_name": "float_input",
        "input_size": 114,
        "task_type": "summarization",
        "labels": ["unimportant", "important"],
        "vectorizer_file": "summarizer_vectorizer.pkl",
    },
}


def _get_session(model_id: str) -> ort.InferenceSession:
    if model_id not in _model_cache:
        config = MODEL_CONFIG.get(model_id)
        if config is None:
            raise ValueError(f"Unknown model: {model_id}")
        path = MODELS_DIR / config["onnx_file"]
        if not path.exists():
            raise FileNotFoundError(f"ONNX model not found: {path}")
        _model_cache[model_id] = ort.InferenceSession(str(path))
    return _model_cache[model_id]


def _get_vectorizer(model_id: str):
    if model_id not in _vectorizer_cache:
        config = MODEL_CONFIG.get(model_id)
        if config is None or "vectorizer_file" not in config:
            return None
        path = MODELS_DIR / config["vectorizer_file"]
        if not path.exists():
            raise FileNotFoundError(f"Vectorizer not found: {path}")
        with open(path, "rb") as f:
            _vectorizer_cache[model_id] = pickle.load(f)
    return _vectorizer_cache.get(model_id)


def _preprocess_mnist(input_data: list | np.ndarray) -> np.ndarray:
    arr = np.array(input_data, dtype=np.float32)
    if arr.ndim == 1 and arr.size == 784:
        arr = arr.reshape(1, 784)
    elif arr.ndim == 2 and arr.shape == (28, 28):
        arr = arr.reshape(1, 784)
    elif arr.ndim == 2 and arr.shape[1] == 784:
        pass
    elif arr.ndim == 3 and arr.shape == (1, 28, 28):
        arr = arr.reshape(1, 784)
    elif arr.ndim == 3 and arr.shape[2] == 784:
        arr = arr.reshape(-1, 784)
    else:
        raise ValueError(
            f"MNIST input must be [784], [28,28], [N,784], or [1,28,28], got shape {arr.shape}"
        )
    if arr.max() > 1.0:
        arr = arr / 255.0
    return arr


def _preprocess_sentiment(input_data: str | list) -> np.ndarray:
    vec = _get_vectorizer("sentiment")
    if vec is None:
        raise RuntimeError("Sentiment vectorizer not loaded")
    text = input_data if isinstance(input_data, str) else " ".join(input_data)
    features = vec.transform([text]).toarray().astype(np.float32)
    return features


def _preprocess_summarizer(input_data: str | list) -> np.ndarray:
    vec = _get_vectorizer("summarizer")
    if vec is None:
        raise RuntimeError("Summarizer vectorizer not loaded")
    text = input_data if isinstance(input_data, str) else " ".join(input_data)
    features = vec.transform([text]).toarray().astype(np.float32)
    return features


_PREPROCESSORS = {
    "mnist": _preprocess_mnist,
    "sentiment": _preprocess_sentiment,
    "summarizer": _preprocess_summarizer,
}


def _extract_probabilities(raw_output) -> dict[str, float]:
    if isinstance(raw_output, list) and len(raw_output) > 0:
        first = raw_output[0]
        if isinstance(first, dict):
            return {str(k): float(v) for k, v in first.items()}
    return {}


def run_inference(model_id: str, input_data: Any) -> dict:
    config = MODEL_CONFIG.get(model_id)
    if config is None:
        raise ValueError(f"Unknown model: {model_id}")

    session = _get_session(model_id)
    preprocessor = _PREPROCESSORS.get(model_id)
    if preprocessor is None:
        raise ValueError(f"No preprocessor for model: {model_id}")

    processed = preprocessor(input_data)

    input_name = config["input_name"]
    raw_outputs = session.run(None, {input_name: processed})

    label_idx = int(raw_outputs[0][0])
    probabilities = (
        _extract_probabilities(raw_outputs[1]) if len(raw_outputs) > 1 else {}
    )

    predicted_label = (
        config["labels"][label_idx]
        if label_idx < len(config["labels"])
        else str(label_idx)
    )

    confidence = 0.0
    if probabilities:
        confidence = max(probabilities.values())

    return {
        "model_id": model_id,
        "prediction": predicted_label,
        "prediction_index": label_idx,
        "confidence": round(confidence, 6),
        "probabilities": probabilities,
        "task_type": config["task_type"],
    }


def get_model_info(model_id: str) -> dict | None:
    config = MODEL_CONFIG.get(model_id)
    if config is None:
        return None
    session = _get_session(model_id)
    meta = session.get_modelmeta()
    return {
        "model_id": model_id,
        "task_type": config["task_type"],
        "input_name": config["input_name"],
        "input_size": config["input_size"],
        "labels": config["labels"],
        "onnx_file": config["onnx_file"],
        "producer_name": meta.producer_name,
        "description": meta.description,
    }
