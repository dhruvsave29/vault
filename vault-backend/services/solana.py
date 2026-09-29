import hashlib
import os
from typing import Optional

from dotenv import load_dotenv
from solders.pubkey import Pubkey

load_dotenv()

PROGRAM_ID = Pubkey.from_string(
    os.getenv("PROGRAM_ID", "11111111111111111111111111111111")
)

MODEL_SEED = b"model"
INFERENCE_SEED = b"inference"
NODE_SEED = b"node"
SUBSCRIPTION_SEED = b"subscription"
ESCROW_SEED = b"escrow"
REPUTATION_SEED = b"reputation"
GLOBAL_SEED = b"global"
OWNERSHIP_MINT_SEED = b"ownership_mint"


def derive_global_pda() -> tuple[Pubkey, int]:
    return Pubkey.find_program_address([GLOBAL_SEED], PROGRAM_ID)


def derive_escrow_pda() -> tuple[Pubkey, int]:
    return Pubkey.find_program_address([ESCROW_SEED], PROGRAM_ID)


def derive_model_pda(model_id: int) -> tuple[Pubkey, int]:
    return Pubkey.find_program_address(
        [MODEL_SEED, model_id.to_bytes(8, "little")], PROGRAM_ID
    )


def derive_reputation_pda(model_pda: Pubkey) -> tuple[Pubkey, int]:
    return Pubkey.find_program_address([REPUTATION_SEED, bytes(model_pda)], PROGRAM_ID)


def derive_node_pda(node_address: Pubkey) -> tuple[Pubkey, int]:
    return Pubkey.find_program_address([NODE_SEED, bytes(node_address)], PROGRAM_ID)


def derive_inference_pda(requester: Pubkey, nonce: int) -> tuple[Pubkey, int]:
    return Pubkey.find_program_address(
        [INFERENCE_SEED, bytes(requester), nonce.to_bytes(8, "little")], PROGRAM_ID
    )


def derive_subscription_pda(subscriber: Pubkey, model: Pubkey) -> tuple[Pubkey, int]:
    return Pubkey.find_program_address(
        [SUBSCRIPTION_SEED, bytes(subscriber), bytes(model)], PROGRAM_ID
    )


def derive_ownership_mint_pda(model_id: int) -> tuple[Pubkey, int]:
    return Pubkey.find_program_address(
        [OWNERSHIP_MINT_SEED, model_id.to_bytes(8, "little")], PROGRAM_ID
    )


def _anchor_discriminator(account_name: str) -> bytes:
    preimage = f"account:{account_name}"
    return hashlib.sha256(preimage.encode()).digest()[:8]


DISCRIMINATORS = {
    "GlobalState": _anchor_discriminator("GlobalState"),
    "ModelRegistry": _anchor_discriminator("ModelRegistry"),
    "InferenceRequest": _anchor_discriminator("InferenceRequest"),
    "ComputeNode": _anchor_discriminator("ComputeNode"),
    "Subscription": _anchor_discriminator("Subscription"),
    "RevenueEscrow": _anchor_discriminator("RevenueEscrow"),
    "Reputation": _anchor_discriminator("Reputation"),
}


def _read_u64(data: bytes, offset: int) -> int:
    return int.from_bytes(data[offset : offset + 8], "little")


def _read_u32(data: bytes, offset: int) -> int:
    return int.from_bytes(data[offset : offset + 4], "little")


def _read_u16(data: bytes, offset: int) -> int:
    return int.from_bytes(data[offset : offset + 2], "little")


def _read_u8(data: bytes, offset: int) -> int:
    return data[offset]


def _read_bool(data: bytes, offset: int) -> bool:
    return data[offset] != 0


def _read_pubkey(data: bytes, offset: int) -> Pubkey:
    return Pubkey.from_bytes(data[offset : offset + 32])


def _read_i64(data: bytes, offset: int) -> int:
    val = int.from_bytes(data[offset : offset + 8], "little")
    if val >= (1 << 63):
        val -= 1 << 64
    return val


def _read_string(data: bytes, offset: int) -> tuple[str, int]:
    length = _read_u32(data, offset)
    offset += 4
    s = data[offset : offset + length].decode("utf-8")
    return s, offset + length


def _read_vec_pubkey(data: bytes, offset: int) -> tuple[list[Pubkey], int]:
    count = _read_u32(data, offset)
    offset += 4
    result = []
    for _ in range(count):
        result.append(_read_pubkey(data, offset))
        offset += 32
    return result, offset


def _read_vec_u16(data: bytes, offset: int) -> tuple[list[int], int]:
    count = _read_u32(data, offset)
    offset += 4
    result = []
    for _ in range(count):
        result.append(_read_u16(data, offset))
        offset += 2
    return result, offset


def _read_vec_u64(data: bytes, offset: int) -> tuple[list[int], int]:
    count = _read_u32(data, offset)
    offset += 4
    result = []
    for _ in range(count):
        result.append(_read_u64(data, offset))
        offset += 8
    return result, offset


def _read_vec_bytes32(data: bytes, offset: int) -> tuple[list[bytes], int]:
    count = _read_u32(data, offset)
    offset += 4
    result = []
    for _ in range(count):
        result.append(data[offset : offset + 32])
        offset += 32
    return result, offset


def parse_model_registry(data: bytes) -> Optional[dict]:
    if len(data) < 8:
        return None
    disc = data[:8]
    if disc != DISCRIMINATORS["ModelRegistry"]:
        return None
    d = data[8:]
    try:
        offset = 0
        bump = _read_u8(d, offset)
        offset += 1
        model_id = _read_u64(d, offset)
        offset += 8
        owner = _read_pubkey(d, offset)
        offset += 32
        ownership_token_mint = _read_pubkey(d, offset)
        offset += 32
        ipfs_cid, offset = _read_string(d, offset)
        encryption_key_hash = d[offset : offset + 32]
        offset += 32
        model_format = _read_u8(d, offset)
        offset += 1
        task_type = _read_u8(d, offset)
        offset += 1
        framework_version, offset = _read_string(d, offset)
        accuracy_claim = _read_u16(d, offset)
        offset += 2
        zk_accuracy_proof_hash = d[offset : offset + 32]
        offset += 32
        price_per_use = _read_u64(d, offset)
        offset += 8
        subscription_price = _read_u64(d, offset)
        offset += 8
        is_listed_for_sale = _read_bool(d, offset)
        offset += 1
        sale_price = _read_u64(d, offset)
        offset += 8
        contributors, offset = _read_vec_pubkey(d, offset)
        contribution_shares, offset = _read_vec_u16(d, offset)
        contribution_proofs, offset = _read_vec_bytes32(d, offset)
        accumulated_revenue, offset = _read_vec_u64(d, offset)
        total_revenue = _read_u64(d, offset)
        offset += 8
        inference_count = _read_u64(d, offset)
        offset += 8
        reputation_score = _read_u32(d, offset)
        offset += 4
        total_ratings = _read_u32(d, offset)
        offset += 4
        sum_ratings = _read_u32(d, offset)
        offset += 4
        is_active = _read_bool(d, offset)
        offset += 1
        created_at = _read_i64(d, offset)
        offset += 8
        updated_at = _read_i64(d, offset)
        offset += 8
        delegate_validator = _read_pubkey(d, offset)
        offset += 32

        return {
            "bump": bump,
            "model_id": model_id,
            "owner": str(owner),
            "ownership_token_mint": str(ownership_token_mint),
            "ipfs_cid": ipfs_cid,
            "encryption_key_hash": encryption_key_hash.hex(),
            "model_format": model_format,
            "task_type": task_type,
            "framework_version": framework_version,
            "accuracy_claim": accuracy_claim,
            "zk_accuracy_proof_hash": zk_accuracy_proof_hash.hex(),
            "price_per_use": price_per_use,
            "price_per_use_sol": price_per_use / 1e9,
            "subscription_price": subscription_price,
            "subscription_price_sol": subscription_price / 1e9,
            "is_listed_for_sale": is_listed_for_sale,
            "sale_price": sale_price,
            "contributors": [str(c) for c in contributors],
            "contribution_shares": contribution_shares,
            "contribution_proofs": [p.hex() for p in contribution_proofs],
            "accumulated_revenue": accumulated_revenue,
            "total_revenue": total_revenue,
            "inference_count": inference_count,
            "reputation_score": reputation_score,
            "total_ratings": total_ratings,
            "sum_ratings": sum_ratings,
            "is_active": is_active,
            "created_at": created_at,
            "updated_at": updated_at,
            "delegate_validator": str(delegate_validator),
        }
    except Exception as e:
        return None


def parse_global_state(data: bytes) -> Optional[dict]:
    if len(data) < 8:
        return None
    disc = data[:8]
    if disc != DISCRIMINATORS["GlobalState"]:
        return None
    d = data[8:]
    try:
        offset = 0
        bump = _read_u8(d, offset)
        offset += 1
        model_counter = _read_u64(d, offset)
        offset += 8
        inference_counter = _read_u64(d, offset)
        offset += 8
        authority = _read_pubkey(d, offset)
        offset += 32
        return {
            "bump": bump,
            "model_counter": model_counter,
            "inference_counter": inference_counter,
            "authority": str(authority),
        }
    except Exception:
        return None


def parse_subscription(data: bytes) -> Optional[dict]:
    if len(data) < 8:
        return None
    disc = data[:8]
    if disc != DISCRIMINATORS["Subscription"]:
        return None
    d = data[8:]
    try:
        offset = 0
        bump = _read_u8(d, offset)
        offset += 1
        subscriber = _read_pubkey(d, offset)
        offset += 32
        model = _read_pubkey(d, offset)
        offset += 32
        start_time = _read_i64(d, offset)
        offset += 8
        expiry_time = _read_i64(d, offset)
        offset += 8
        amount_paid = _read_u64(d, offset)
        offset += 8
        inference_count = _read_u64(d, offset)
        offset += 8
        is_active = _read_bool(d, offset)
        offset += 1
        return {
            "bump": bump,
            "subscriber": str(subscriber),
            "model": str(model),
            "start_time": start_time,
            "expiry_time": expiry_time,
            "amount_paid": amount_paid,
            "inference_count": inference_count,
            "is_active": is_active,
        }
    except Exception:
        return None


def parse_compute_node(data: bytes) -> Optional[dict]:
    if len(data) < 8:
        return None
    disc = data[:8]
    if disc != DISCRIMINATORS["ComputeNode"]:
        return None
    d = data[8:]
    try:
        offset = 0
        bump = _read_u8(d, offset)
        offset += 1
        node_address = _read_pubkey(d, offset)
        offset += 32
        endpoint_url, offset = _read_string(d, offset)
        stake = _read_u64(d, offset)
        offset += 8
        inference_count = _read_u64(d, offset)
        offset += 8
        total_inference_time_ms = _read_u64(d, offset)
        offset += 8
        uptime_score = _read_u32(d, offset)
        offset += 4
        reputation = _read_u32(d, offset)
        offset += 4
        tee_attestation_hash = d[offset : offset + 32]
        offset += 32
        supported_task_types = _read_u16(d, offset)
        offset += 2
        max_model_size_kb = _read_u32(d, offset)
        offset += 4
        is_active = _read_bool(d, offset)
        offset += 1
        registered_at = _read_i64(d, offset)
        offset += 8
        last_heartbeat = _read_i64(d, offset)
        offset += 8
        accumulated_revenue = _read_u64(d, offset)
        offset += 8
        return {
            "bump": bump,
            "node_address": str(node_address),
            "endpoint_url": endpoint_url,
            "stake": stake,
            "inference_count": inference_count,
            "total_inference_time_ms": total_inference_time_ms,
            "uptime_score": uptime_score,
            "reputation": reputation,
            "tee_attestation_hash": tee_attestation_hash.hex(),
            "supported_task_types": supported_task_types,
            "max_model_size_kb": max_model_size_kb,
            "is_active": is_active,
            "registered_at": registered_at,
            "last_heartbeat": last_heartbeat,
            "accumulated_revenue": accumulated_revenue,
        }
    except Exception:
        return None


TASK_TYPE_MAP = {
    0: "classification",
    1: "sentiment",
    2: "summarization",
    3: "object_detection",
}
