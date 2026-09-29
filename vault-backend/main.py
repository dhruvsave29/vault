from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import base64
import httpx

load_dotenv()

app = FastAPI(
    title="VAULT Backend",
    description="Decentralized AI Model Marketplace — Compute Node + Inference Engine",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers.inference import router as inference_router
from routers.discovery import router as discovery_router
from routers.upload import router as upload_router

app.include_router(inference_router)
app.include_router(discovery_router)
app.include_router(upload_router)


@app.get("/v1/health")
async def health():
    from services.solana import derive_node_pda, parse_compute_node
    from solders.keypair import Keypair
    import json

    response = {
        "status": "active",
        "program_id": os.getenv("PROGRAM_ID", "unknown"),
        "cluster": os.getenv("SOLANA_CLUSTER", "devnet"),
        "rpc": os.getenv("SOLANA_RPC_URL", "unknown")[:50] + "...",
    }

    try:
        key_bytes = json.loads(os.getenv("DEPLOYER_PRIVATE_KEY", "[]"))
        if key_bytes:
            kp = Keypair.from_bytes(key_bytes)
            response["deployer"] = str(kp.pubkey())

            node_pda, _ = derive_node_pda(kp.pubkey())
            rpc = os.getenv("SOLANA_RPC_URL")
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    rpc,
                    json={
                        "jsonrpc": "2.0",
                        "id": 1,
                        "method": "getAccountInfo",
                        "params": [str(node_pda), {"encoding": "base64"}],
                    },
                )
                data = resp.json()
                result = data.get("result", {})
                if result and result.get("value"):
                    raw = base64.b64decode(result["value"]["data"][0])
                    node = parse_compute_node(raw)
                    if node:
                        response["compute_node"] = {
                            "is_active": node["is_active"],
                            "inference_count": node["inference_count"],
                            "reputation": node["reputation"],
                            "uptime_score": node["uptime_score"],
                            "stake_sol": node["stake"] / 1e9,
                        }
    except Exception as e:
        response["compute_node_error"] = str(e)

    return response


@app.get("/")
async def root():
    return {
        "message": "VAULT Backend API",
        "docs": "/docs",
        "endpoints": [
            "POST /v1/inference/{model_id}",
            "GET /v1/models",
            "GET /v1/discover",
            "GET /v1/subscription/check",
            "GET /v1/health",
        ],
    }
