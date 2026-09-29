import os

import httpx
from dotenv import load_dotenv

load_dotenv()

PINATA_JWT = os.getenv("PINATA_JWT")

PINATA_API_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS"
PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs"


async def upload_to_ipfs(file_bytes: bytes, filename: str = "model.encrypted") -> dict:
    headers = {"Authorization": f"Bearer {PINATA_JWT}"}

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            PINATA_API_URL,
            headers=headers,
            files={"file": (filename, file_bytes)},
        )
        resp.raise_for_status()
        data = resp.json()

    cid = data["IpfsHash"]
    return {
        "ipfs_cid": cid,
        "gateway_url": f"{PINATA_GATEWAY}/{cid}",
    }


async def download_from_ipfs(cid: str) -> bytes:
    url = f"{PINATA_GATEWAY}/{cid}"
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.content
