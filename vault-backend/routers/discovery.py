import asyncio
import base64
import os
from typing import Optional

import httpx
from fastapi import APIRouter, Query
from dotenv import load_dotenv

from services.solana import (
    derive_global_pda,
    derive_model_pda,
    derive_subscription_pda,
    parse_global_state,
    parse_model_registry,
    parse_subscription,
    TASK_TYPE_MAP,
    DISCRIMINATORS,
    PROGRAM_ID,
)

load_dotenv()

RPC_URL = os.getenv("SOLANA_RPC_URL", "https://api.devnet.solana.com")

router = APIRouter(prefix="/v1", tags=["discovery"])

_global_cache: Optional[dict] = None
_global_cache_time: float = 0
_CACHE_TTL = 60


async def _get_global_state() -> Optional[dict]:
    global _global_cache, _global_cache_time
    import time

    now = time.time()
    if _global_cache and (now - _global_cache_time) < _CACHE_TTL:
        return _global_cache
    global_pda, _ = derive_global_pda()
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            RPC_URL,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getAccountInfo",
                "params": [str(global_pda), {"encoding": "base64"}],
            },
        )
        data = resp.json()
        result = data.get("result", {})
        if not result or not result.get("value"):
            return None
        raw = base64.b64decode(result["value"]["data"][0])
        gs = parse_global_state(raw)
        if gs:
            _global_cache = gs
            _global_cache_time = now
        return gs


async def _fetch_all_models() -> list[dict]:
    gs = await _get_global_state()
    if not gs:
        return []
    model_count = gs["model_counter"]
    models = []
    for i in range(model_count):
        model_pda, _ = derive_model_pda(i)
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
            if not result or not result.get("value"):
                continue
            raw = base64.b64decode(result["value"]["data"][0])
            model = parse_model_registry(raw)
            if model:
                models.append(model)
    return models


@router.get("/models")
async def list_models():
    models = await _fetch_all_models()
    return {
        "models": [
            {
                "model_id": m["model_id"],
                "owner": m["owner"],
                "task_type": TASK_TYPE_MAP.get(m["task_type"], m["task_type"]),
                "accuracy_claim": m["accuracy_claim"] / 100.0,
                "price_per_use_sol": m["price_per_use_sol"],
                "subscription_price_sol": m["subscription_price_sol"],
                "inference_count": m["inference_count"],
                "reputation_score": m["reputation_score"],
                "is_active": m["is_active"],
                "is_listed_for_sale": m["is_listed_for_sale"],
                "sale_price": m.get("sale_price", 0),
                "sale_price_sol": m.get("sale_price", 0) / 1e9,
                "ownership_token_mint": m.get("ownership_token_mint", ""),
                "contributors_count": len(m["contributors"]),
                "contributors": [
                    {"pubkey": c, "share": s / 100.0}
                    for c, s in zip(m["contributors"], m.get("contribution_shares", []))
                ],
                "ipfs_cid": m["ipfs_cid"],
                "created_at": m.get("created_at", 0),
                "framework_version": m.get("framework_version", ""),
            }
            for m in models
        ],
        "total": len(models),
    }


@router.get("/discover")
async def discover_models(
    task: Optional[str] = Query(None, description="Filter by task type"),
    min_accuracy: Optional[float] = Query(None, description="Min accuracy (0-100)"),
    sort_by: Optional[str] = Query(
        "accuracy", description="Sort by: accuracy, price, popularity"
    ),
):
    models = await _fetch_all_models()

    task_type_map_rev = {v: k for k, v in TASK_TYPE_MAP.items()}
    if task:
        task_byte = task_type_map_rev.get(task)
        if task_byte is not None:
            models = [m for m in models if m["task_type"] == task_byte]

    if min_accuracy is not None:
        models = [m for m in models if m["accuracy_claim"] / 100.0 >= min_accuracy]

    if sort_by == "accuracy":
        models.sort(key=lambda m: m["accuracy_claim"], reverse=True)
    elif sort_by == "price":
        models.sort(key=lambda m: m["price_per_use"])
    elif sort_by == "popularity":
        models.sort(key=lambda m: m["inference_count"], reverse=True)

    return {
        "models": [
            {
                "model_id": m["model_id"],
                "task_type": TASK_TYPE_MAP.get(m["task_type"], m["task_type"]),
                "accuracy": m["accuracy_claim"] / 100.0,
                "price_sol": m["price_per_use_sol"],
                "inference_count": m["inference_count"],
                "reputation": m["reputation_score"],
                "is_active": m["is_active"],
                "contributors": len(m["contributors"]),
            }
            for m in models
        ],
        "total": len(models),
    }


@router.get("/subscription/check")
async def check_subscription(
    subscriber: str = Query(..., description="Subscriber wallet pubkey"),
    model_id: int = Query(..., description="On-chain model ID"),
):
    from solders.pubkey import Pubkey as SPubkey

    try:
        sub_pk = SPubkey.from_string(subscriber)
    except Exception:
        return {"error": "Invalid subscriber pubkey"}

    model_pda, _ = derive_model_pda(model_id)
    sub_pda, _ = derive_subscription_pda(sub_pk, model_pda)

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            RPC_URL,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getAccountInfo",
                "params": [str(sub_pda), {"encoding": "base64"}],
            },
        )
        data = resp.json()
        result = data.get("result", {})
        if not result or not result.get("value"):
            return {"is_active": False, "reason": "No subscription found"}

        raw = base64.b64decode(result["value"]["data"][0])
        sub = parse_subscription(raw)
        if not sub:
            return {"is_active": False, "reason": "Failed to parse subscription"}

        import time

        now = int(time.time())
        is_active = sub["is_active"] and sub["expiry_time"] > now

        return {
            "is_active": is_active,
            "subscriber": sub["subscriber"],
            "model": sub["model"],
            "start_time": sub["start_time"],
            "expiry_time": sub["expiry_time"],
            "amount_paid_lamports": sub["amount_paid"],
            "inference_count": sub["inference_count"],
        }
