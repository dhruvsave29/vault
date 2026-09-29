import hashlib
import json
import time


def generate_tee_attestation(
    model_id: str,
    output_hash: str,
    metrics: dict,
) -> dict:
    timestamp = int(time.time())
    payload = (
        f"{model_id}:{output_hash}:{json.dumps(metrics, sort_keys=True)}:{timestamp}"
    )
    attestation_hash = hashlib.sha256(payload.encode()).hexdigest()

    return {
        "tee_attestation_hash": attestation_hash,
        "model_id": model_id,
        "output_hash": output_hash,
        "timestamp": timestamp,
        "attestation_method": "sha-256-simplified",
        "note": "Simplified TEE attestation for devnet. Real TEE attestation via MagicBlock PER in Phase 4.",
    }


def compute_output_hash(result: dict) -> str:
    canonical = json.dumps(result, sort_keys=True)
    return hashlib.sha256(canonical.encode()).hexdigest()
