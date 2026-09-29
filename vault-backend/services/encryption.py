import base64
import hashlib
import os

from cryptography.hazmat.primitives.ciphers import aead


def compute_key_hash(key_hex: str) -> str:
    raw_key = bytes.fromhex(key_hex)
    return hashlib.sha256(raw_key).hexdigest()


def encrypt_file(file_bytes: bytes, key_hex: str = None) -> dict:
    if not key_hex:
        raw_key = os.urandom(32)
        key_hex = raw_key.hex()
    else:
        raw_key = bytes.fromhex(key_hex)

    iv = os.urandom(12)
    aesgcm = aead.AESGCM(raw_key)
    ciphertext = aesgcm.encrypt(iv, file_bytes, None)

    return {
        "ciphertext_base64": base64.b64encode(ciphertext).decode(),
        "iv_base64": base64.b64encode(iv).decode(),
        "key_hex": key_hex,
        "key_hash": compute_key_hash(key_hex),
    }
