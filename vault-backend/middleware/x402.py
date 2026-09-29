import os
from typing import Optional

from dotenv import load_dotenv
from solders.pubkey import Pubkey

from services.solana import (
    derive_escrow_pda,
    derive_model_pda,
    parse_model_registry,
    TASK_TYPE_MAP,
)
import httpx
import base64

load_dotenv()

RPC_URL = os.getenv("SOLANA_RPC_URL", "https://api.devnet.solana.com")

MODEL_PRICE_CACHE: dict[int, dict] = {}

LOCAL_MODEL_MAP = {
    "mnist": {"on_chain_model_id": 0, "task_type": "classification"},
    "sentiment": {"on_chain_model_id": 0, "task_type": "sentiment"},
    "summarizer": {"on_chain_model_id": 0, "task_type": "summarization"},
}


def _get_escrow_address() -> str:
    escrow_pda, _ = derive_escrow_pda()
    return str(escrow_pda)


async def _fetch_on_chain_model(model_id: int) -> Optional[dict]:
    if model_id in MODEL_PRICE_CACHE:
        return MODEL_PRICE_CACHE[model_id]

    model_pda, _ = derive_model_pda(model_id)
    async with httpx.AsyncClient(timeout=30.0) as client:
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
        if not result or not result.get("value"):
            return None

        raw = base64.b64decode(result["value"]["data"][0])
        model = parse_model_registry(raw)
        if model:
            MODEL_PRICE_CACHE[model_id] = model
        return model


async def get_payment_details(
    model_name: str, on_chain_id: Optional[str] = None
) -> Optional[dict]:
    local_info = LOCAL_MODEL_MAP.get(model_name)
    if not local_info:
        return None

    numeric_id = (
        int(on_chain_id)
        if on_chain_id and on_chain_id.isdigit()
        else local_info["on_chain_model_id"]
    )
    on_chain_model = await _fetch_on_chain_model(numeric_id)

    escrow_address = _get_escrow_address()

    if on_chain_model:
        price_lamports = on_chain_model["price_per_use"]
        task_type = TASK_TYPE_MAP.get(on_chain_model["task_type"], "unknown")
        accuracy = on_chain_model["accuracy_claim"] / 100.0
    else:
        price_lamports = 10_000_000
        task_type = local_info["task_type"]
        accuracy = 94.2

    return {
        "status": "payment_required",
        "pay_to": escrow_address,
        "amount": price_lamports / 1e9,
        "amount_lamports": price_lamports,
        "currency": "SOL",
        "network": "devnet",
        "model_id": model_name,
        "model_name": f"Model #{on_chain_id}" if on_chain_id else model_name,
        "on_chain_model_id": on_chain_id,
        "task_type": task_type,
        "accuracy": accuracy,
    }


def extract_payment_header(headers: dict) -> Optional[str]:
    return headers.get("x-payment") or headers.get("X-Payment")
