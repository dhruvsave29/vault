import asyncio
import hashlib
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Any, Optional, Union

from services.onnx_runner import run_inference, MODEL_CONFIG
from services.metrics import measure_inference
from middleware.tee_attestation import generate_tee_attestation, compute_output_hash
from middleware.x402 import get_payment_details, extract_payment_header
from services.solana_verifier import verify_payment
from services.solana import (
    derive_escrow_pda,
    derive_model_pda,
    parse_model_registry,
    TASK_TYPE_MAP,
)
from services.on_chain_reporter import report_inference_on_chain

import base64
import httpx
import os

RPC_URL = os.getenv("SOLANA_RPC_URL", "https://api.devnet.solana.com")

router = APIRouter(prefix="/v1", tags=["inference"])

ONCHAIN_TO_ONNX = {
    "0": "mnist",
    "1": "mnist",
    "2": "mnist",
    "3": "mnist",
    "4": "mnist",
    "5": "summarizer",
    "6": "mnist",
    "7": "summarizer",
    "8": "mnist",
    "9": "summarizer",
}

TASK_TO_ONNX = {
    "classification": "mnist",
    "sentiment": "sentiment",
    "summarization": "summarizer",
    "object_detection": "mnist",
}

_dynamic_cache: dict[str, str] = {}


class InferenceInput(BaseModel):
    input_data: Any
    input_text: Optional[str] = None


async def _resolve_model(model_id: str) -> str:
    if model_id in MODEL_CONFIG:
        return model_id
    if model_id in ONCHAIN_TO_ONNX:
        return ONCHAIN_TO_ONNX[model_id]
    if model_id in _dynamic_cache:
        return _dynamic_cache[model_id]
    try:
        mid = int(model_id)
        model_pda, _ = derive_model_pda(mid)
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                RPC_URL,
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "getAccountInfo",
                    "params": [str(model_pda), {"encoding": "base64"}],
                },
            )
            data = resp.json()
            result = data.get("result", {})
            if result and result.get("value"):
                raw = base64.b64decode(result["value"]["data"][0])
                model = parse_model_registry(raw)
                if model:
                    task_name = TASK_TYPE_MAP.get(model["task_type"], "classification")
                    onnx_key = TASK_TO_ONNX.get(task_name, "mnist")
                    _dynamic_cache[model_id] = onnx_key
                    return onnx_key
    except Exception:
        pass
    return ""


@router.post("/inference/{model_id}")
async def inference(model_id: str, request: Request, body: InferenceInput):
    onnx_key = await _resolve_model(model_id)
    if not onnx_key or onnx_key not in MODEL_CONFIG:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")

    payment_sig = extract_payment_header(dict(request.headers))

    if not payment_sig:
        payment_details = await get_payment_details(onnx_key, on_chain_id=model_id)
        if not payment_details:
            raise HTTPException(
                status_code=404,
                detail=f"Model '{model_id}' not registered on-chain",
            )
        return JSONResponse(status_code=402, content=payment_details)

    payment_details = await get_payment_details(onnx_key, on_chain_id=model_id)
    if not payment_details:
        raise HTTPException(
            status_code=404, detail=f"Model '{model_id}' not registered on-chain"
        )

    escrow_pda, _ = derive_escrow_pda()
    verification = await verify_payment(
        tx_signature=payment_sig,
        expected_amount_lamports=payment_details["amount_lamports"],
        expected_recipient=str(escrow_pda),
    )

    if not verification["verified"]:
        raise HTTPException(
            status_code=403,
            detail=f"Payment verification failed: {verification['reason']}",
        )

    actual_input = body.input_text if body.input_text else body.input_data
    metrics_result = measure_inference(run_inference, onnx_key, actual_input)
    inference_result = metrics_result.pop("result")

    output_hash = compute_output_hash(inference_result)
    attestation = generate_tee_attestation(
        model_id=onnx_key,
        output_hash=output_hash,
        metrics=metrics_result,
    )

    probabilities = inference_result.get("probabilities", {})
    prob_list = []
    if isinstance(probabilities, dict):
        max_idx = max((int(k) for k in probabilities), default=-1)
        prob_list = [probabilities.get(str(i), 0.0) for i in range(max_idx + 1)]

    response = {
        "status": "success",
        "model_id": model_id,
        "onnx_model": onnx_key,
        "on_chain_model_id": payment_details.get("on_chain_model_id"),
        "prediction": inference_result.get("prediction"),
        "confidence": inference_result.get("confidence", 0),
        "probabilities": prob_list,
        "task_type": inference_result.get("task_type", ""),
        "result": inference_result,
        "metrics": {
            "inference_time_ms": metrics_result["inference_time_ms"],
            "input_tokens": metrics_result["input_tokens"],
            "output_tokens": metrics_result["output_tokens"],
            "compute_flops": metrics_result["compute_flops"],
            "memory_peak_kb": metrics_result["memory_peak_kb"],
        },
        "attestation": {
            "tee_attestation_hash": attestation.get("tee_attestation_hash", ""),
            "output_hash": output_hash,
        },
        "tee_attestation": attestation,
        "payment": {
            "verified": True,
            "signature": payment_sig,
            "tx_signature": payment_sig,
            "amount_sol": verification.get("transfer_amount_sol"),
            "amount_lamports": verification.get("transfer_amount_lamports"),
            "slot": verification.get("slot"),
        },
    }

    on_chain_model_id = payment_details.get("on_chain_model_id", 0)
    input_hash = hashlib.sha256(str(body.input_data).encode()).digest()
    output_hash_bytes = (
        bytes.fromhex(output_hash[:64])
        if len(output_hash) >= 64
        else hashlib.sha256(output_hash.encode()).digest()
    )
    tee_hash_bytes = bytes.fromhex(attestation["tee_attestation_hash"])

    asyncio.ensure_future(
        report_inference_on_chain(
            model_id=on_chain_model_id,
            input_hash=input_hash,
            output_hash=output_hash_bytes,
            inference_time_ms=int(metrics_result["inference_time_ms"]),
            input_tokens=metrics_result["input_tokens"],
            output_tokens=metrics_result["output_tokens"],
            compute_flops=metrics_result["compute_flops"],
            memory_peak_kb=metrics_result["memory_peak_kb"],
            tee_attestation_hash=tee_hash_bytes,
            payment_signature=payment_sig,
        )
    )

    return response
