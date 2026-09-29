import base64
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form
from dotenv import load_dotenv

from services.encryption import encrypt_file
from services.ipfs import upload_to_ipfs

load_dotenv()

router = APIRouter(prefix="/v1", tags=["upload"])


@router.post("/encrypt")
async def encrypt_endpoint(
    file: UploadFile = File(...),
    encryption_key: Optional[str] = Form(None),
):
    file_bytes = await file.read()
    result = encrypt_file(file_bytes, encryption_key)
    return result


@router.post("/upload/ipfs")
async def upload_ipfs_endpoint(
    file: UploadFile = File(...),
):
    file_bytes = await file.read()
    result = await upload_to_ipfs(
        file_bytes, filename=file.filename or "model.encrypted"
    )
    return result


@router.post("/models/upload")
async def models_upload(
    file: UploadFile = File(...),
    task_type: str = Form(...),
    framework_version: str = Form(...),
    accuracy_claim: float = Form(...),
    price_per_use: float = Form(...),
    subscription_price: float = Form(...),
):
    file_bytes = await file.read()

    enc_result = encrypt_file(file_bytes)

    ipfs_result = await upload_to_ipfs(
        base64.b64decode(enc_result["ciphertext_base64"]),
        filename="model.encrypted",
    )

    return {
        "ipfs_cid": ipfs_result["ipfs_cid"],
        "gateway_url": ipfs_result["gateway_url"],
        "encryption_key_hash": enc_result["key_hash"],
        "encryption_key_hex": enc_result["key_hex"],
        "iv_base64": enc_result["iv_base64"],
        "metadata": {
            "task_type": task_type,
            "framework_version": framework_version,
            "accuracy_claim": accuracy_claim,
            "price_per_use": price_per_use,
            "subscription_price": subscription_price,
        },
    }
