import asyncio
import os
from typing import Optional

import httpx
from dotenv import load_dotenv

load_dotenv()

RPC_URL = os.getenv("SOLANA_RPC_URL", "https://api.devnet.solana.com")


def _extract_account_keys(tx_data: dict) -> list[str]:
    msg = tx_data.get("transaction", {}).get("message", {})
    raw_keys = msg.get("accountKeys", [])
    keys = []
    for acc in raw_keys:
        if isinstance(acc, str):
            keys.append(acc)
        elif isinstance(acc, dict):
            keys.append(acc.get("pubkey", acc.get("signer", "")))
        elif isinstance(acc, list):
            for sub in acc:
                if isinstance(sub, str):
                    keys.append(sub)
                elif isinstance(sub, dict):
                    keys.append(sub.get("pubkey", ""))
    return keys


async def verify_payment(
    tx_signature: str,
    expected_amount_lamports: int,
    expected_recipient: str,
    max_retries: int = 5,
    retry_delay: float = 3.0,
) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        for attempt in range(max_retries):
            payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getTransaction",
                "params": [
                    tx_signature,
                    {
                        "encoding": "json",
                        "maxSupportedTransactionVersion": 0,
                        "commitment": "confirmed",
                    },
                ],
            }
            try:
                resp = await client.post(RPC_URL, json=payload)
                data = resp.json()
            except Exception as e:
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_delay)
                    continue
                return {"verified": False, "reason": f"RPC request failed: {e}"}

            if data.get("error"):
                err_code = data["error"].get("code", 0)
                err_msg = data["error"].get("message", "")

                if err_code == -32602:
                    return {
                        "verified": False,
                        "reason": "Invalid transaction signature format",
                    }

                if "not found" in err_msg.lower():
                    if attempt < max_retries - 1:
                        await asyncio.sleep(retry_delay)
                        continue
                    return {
                        "verified": False,
                        "reason": f"Transaction not found after {max_retries} attempts",
                    }

                return {"verified": False, "reason": f"RPC error: {err_msg}"}

            tx = data.get("result")
            if tx is None:
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_delay)
                    continue
                return {"verified": False, "reason": "Transaction not found"}

            meta = tx.get("meta", {})
            if meta.get("err") is not None:
                return {
                    "verified": False,
                    "reason": f"Transaction failed on-chain: {meta['err']}",
                }

            account_keys = _extract_account_keys(tx)
            pre_balances = meta.get("preBalances", [])
            post_balances = meta.get("postBalances", [])

            if not account_keys or not pre_balances or not post_balances:
                return {
                    "verified": False,
                    "reason": "Could not parse transaction account keys or balances",
                }

            transfer_amount = None
            for i, key in enumerate(account_keys):
                if (
                    key == expected_recipient
                    and i < len(pre_balances)
                    and i < len(post_balances)
                ):
                    delta = post_balances[i] - pre_balances[i]
                    if delta > 0:
                        transfer_amount = delta
                        break

            if transfer_amount is None:
                return {
                    "verified": False,
                    "reason": f"No SOL transfer found to {expected_recipient}",
                }

            if transfer_amount < expected_amount_lamports:
                return {
                    "verified": False,
                    "reason": f"Transfer amount {transfer_amount} lamports < expected {expected_amount_lamports}",
                }

            slot = tx.get("slot", 0)
            block_time = tx.get("blockTime", 0)

            return {
                "verified": True,
                "transfer_amount_lamports": transfer_amount,
                "transfer_amount_sol": transfer_amount / 1e9,
                "recipient": expected_recipient,
                "slot": slot,
                "block_time": block_time,
                "tx_signature": tx_signature,
            }

    return {"verified": False, "reason": "Max retries exceeded"}
