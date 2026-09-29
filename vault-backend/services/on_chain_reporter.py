import asyncio
import base64
import hashlib
import json
import os
import struct
from typing import Optional

import httpx
from dotenv import load_dotenv
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.transaction import VersionedTransaction
from solders.message import MessageV0
from solders.instruction import Instruction, AccountMeta
from solders.hash import Hash

from services.solana import (
    PROGRAM_ID,
    derive_global_pda,
    derive_model_pda,
    derive_inference_pda,
    derive_node_pda,
    derive_reputation_pda,
    derive_escrow_pda,
    parse_global_state,
)

load_dotenv()

RPC_URL = os.getenv("SOLANA_RPC_URL", "https://api.devnet.solana.com")

_deployer_kp: Optional[Keypair] = None
_node_registered: bool = False


def _get_deployer_keypair() -> Keypair:
    global _deployer_kp
    if _deployer_kp is None:
        key_bytes = json.loads(os.getenv("DEPLOYER_PRIVATE_KEY", "[]"))
        _deployer_kp = Keypair.from_bytes(key_bytes)
    return _deployer_kp


def _instruction_discriminator(name: str) -> bytes:
    preimage = f"global:{name}"
    return hashlib.sha256(preimage.encode()).digest()[:8]


REQUEST_INFERENCE_DISC = _instruction_discriminator("request_inference")
COMPLETE_INFERENCE_DISC = _instruction_discriminator("complete_inference")
REGISTER_NODE_DISC = _instruction_discriminator("register_node")


async def _get_inference_counter() -> int:
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
            return 0
        raw = base64.b64decode(result["value"]["data"][0])
        gs = parse_global_state(raw)
        return gs["inference_counter"] if gs else 0


async def _get_latest_blockhash() -> str:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            RPC_URL,
            json={"jsonrpc": "2.0", "id": 1, "method": "getLatestBlockhash"},
        )
        data = resp.json()
        return data["result"]["value"]["blockhash"]


async def _send_transaction(
    tx: VersionedTransaction, skip_preflight: bool = True
) -> Optional[str]:
    tx_b64 = base64.b64encode(bytes(tx)).decode()
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            RPC_URL,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "sendTransaction",
                "params": [
                    tx_b64,
                    {
                        "encoding": "base64",
                        "skipPreflight": skip_preflight,
                        "maxSupportedTransactionVersion": 0,
                        "preflightCommitment": "confirmed",
                    },
                ],
            },
        )
        data = resp.json()
        if data.get("error"):
            print(f"TX send error: {data['error']}")
            return None
        return data.get("result")


async def _confirm_transaction(sig: str, timeout: float = 30.0) -> bool:
    deadline = asyncio.get_event_loop().time() + timeout
    async with httpx.AsyncClient(timeout=30.0) as client:
        while asyncio.get_event_loop().time() < deadline:
            resp = await client.post(
                RPC_URL,
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "getSignatureStatuses",
                    "params": [[sig]],
                },
            )
            data = resp.json()
            status = data.get("result", {}).get("value", [None])[0]
            if status is not None:
                if status.get("err"):
                    print(f"TX failed: {status['err']}")
                    return False
                return True
            await asyncio.sleep(1.0)
    print(f"TX confirmation timeout: {sig}")
    return False


async def _build_and_send(
    ix: Instruction, kp: Keypair, skip_preflight: bool = True
) -> Optional[str]:
    blockhash_str = await _get_latest_blockhash()
    msg = MessageV0.try_compile(
        payer=kp.pubkey(),
        instructions=[ix],
        address_lookup_table_accounts=[],
        recent_blockhash=Hash.from_string(blockhash_str),
    )
    tx = VersionedTransaction(msg, [kp])
    return await _send_transaction(tx, skip_preflight=skip_preflight)


async def ensure_node_registered() -> bool:
    global _node_registered
    if _node_registered:
        return True

    kp = _get_deployer_keypair()
    node_pda, _ = derive_node_pda(kp.pubkey())

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            RPC_URL,
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
            _node_registered = True
            return True

    endpoint_url = "https://vault-compute-node.onrender.com"
    supported_task_types = 0xFFFF
    max_model_size_kb = 100000

    endpoint_bytes = endpoint_url.encode("utf-8")
    args_data = (
        REGISTER_NODE_DISC
        + struct.pack("<I", len(endpoint_bytes))
        + endpoint_bytes
        + struct.pack("<H", supported_task_types)
        + struct.pack("<I", max_model_size_kb)
    )

    system_program = Pubkey.from_string("11111111111111111111111111111111")

    try:
        ix = Instruction(
            program_id=PROGRAM_ID,
            data=args_data,
            accounts=[
                AccountMeta(pubkey=kp.pubkey(), is_signer=True, is_writable=True),
                AccountMeta(pubkey=node_pda, is_signer=False, is_writable=True),
                AccountMeta(pubkey=system_program, is_signer=False, is_writable=False),
            ],
        )
        sig = await _build_and_send(ix, kp, skip_preflight=False)
        if not sig:
            return False
        confirmed = await _confirm_transaction(sig, timeout=30.0)
        if confirmed:
            print(f"Node registered! tx: {sig}")
            _node_registered = True
            return True
        return False
    except Exception as e:
        print(f"Node register error: {e}")
        return False


async def report_inference_on_chain(
    model_id: int,
    input_hash: bytes,
    output_hash: bytes,
    inference_time_ms: int,
    input_tokens: int,
    output_tokens: int,
    compute_flops: int,
    memory_peak_kb: int,
    tee_attestation_hash: bytes,
    payment_signature: str = "",
) -> Optional[str]:
    await ensure_node_registered()

    kp = _get_deployer_keypair()
    global_pda, _ = derive_global_pda()
    model_pda, _ = derive_model_pda(model_id)
    escrow_pda, _ = derive_escrow_pda()
    node_pda, _ = derive_node_pda(kp.pubkey())
    reputation_pda, _ = derive_reputation_pda(model_pda)
    system_program = Pubkey.from_string("11111111111111111111111111111111")

    nonce = await _get_inference_counter()
    inference_pda, _ = derive_inference_pda(kp.pubkey(), nonce)

    payment_sig_bytes = (
        payment_signature.encode("utf-8") if payment_signature else b"backend_reported"
    )

    request_args = (
        REQUEST_INFERENCE_DISC
        + input_hash
        + struct.pack("<I", len(payment_sig_bytes))
        + payment_sig_bytes
    )

    request_ix = Instruction(
        program_id=PROGRAM_ID,
        data=request_args,
        accounts=[
            AccountMeta(pubkey=kp.pubkey(), is_signer=True, is_writable=True),
            AccountMeta(pubkey=global_pda, is_signer=False, is_writable=True),
            AccountMeta(pubkey=model_pda, is_signer=False, is_writable=True),
            AccountMeta(pubkey=inference_pda, is_signer=False, is_writable=True),
            AccountMeta(pubkey=escrow_pda, is_signer=False, is_writable=True),
            AccountMeta(pubkey=system_program, is_signer=False, is_writable=False),
        ],
    )

    try:
        request_sig = await _build_and_send(request_ix, kp, skip_preflight=False)
        if not request_sig:
            print("request_inference TX submission failed")
            return None

        confirmed = await _confirm_transaction(request_sig, timeout=30.0)
        if not confirmed:
            print(f"request_inference TX failed on-chain: {request_sig}")
            return None
        print(f"request_inference confirmed: {request_sig}")
    except Exception as e:
        print(f"request_inference error: {e}")
        return None

    complete_args = (
        COMPLETE_INFERENCE_DISC
        + output_hash
        + struct.pack("<I", inference_time_ms)
        + struct.pack("<I", input_tokens)
        + struct.pack("<I", output_tokens)
        + struct.pack("<Q", compute_flops)
        + struct.pack("<I", memory_peak_kb)
        + tee_attestation_hash
    )

    complete_ix = Instruction(
        program_id=PROGRAM_ID,
        data=complete_args,
        accounts=[
            AccountMeta(pubkey=kp.pubkey(), is_signer=True, is_writable=True),
            AccountMeta(pubkey=inference_pda, is_signer=False, is_writable=True),
            AccountMeta(pubkey=model_pda, is_signer=False, is_writable=True),
            AccountMeta(pubkey=node_pda, is_signer=False, is_writable=True),
            AccountMeta(pubkey=reputation_pda, is_signer=False, is_writable=True),
        ],
    )

    try:
        complete_sig = await _build_and_send(complete_ix, kp, skip_preflight=False)
        if complete_sig:
            print(f"complete_inference submitted: {complete_sig}")
            return complete_sig
        print("complete_inference TX submission failed")
        return None
    except Exception as e:
        print(f"complete_inference error: {e}")
        return None
