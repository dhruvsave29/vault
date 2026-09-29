# VAULT — Decentralized AI Model Marketplace

*A trustless, transparent marketplace for publishing, sharing, and monetizing AI models — powered by Solana.*

**Synergy 3.0 Hackathon** | **MagicBlock V4 Hackathon**

---

## Problem

AI developers have no decentralized way to monetize their models without relying on centralized platforms that take excessive cuts, lack transparency, and create single points of failure. Users accessing these models have no way to verify model integrity, provenance, or fair pricing.

## Solution

**VAULT** is a fully on-chain AI model marketplace built on Solana Devnet that enables:

- **Model Contributors** — Upload encrypted AI models to IPFS, set per-inference pricing, and earn 70% of revenue
- **Compute Nodes** — Run inference in a TEE-attested environment, earn 25% of revenue
- **Users** — Pay per-inference via x402 protocol, verify TEE attestation, browse and buy models
- **Ownership Transfer** — List models for sale, buy models, transfer ownership via Token-2022 NFTs, add contributors with revenue shares

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│    Solana     │
│  (Next.js)   │     │  (FastAPI)   │     │   Devnet      │
│              │     │              │     │              │
│ Wallet Auth  │     │ ONNX Runtime │     │ Anchor Prog  │
│ Tx Signing   │     │ x402 Payment │     │ Token-2022   │
│ Marketplace  │     │ TEE Attest   │     │ IPFS CIDs    │
└─────────────┘     └──────────────┘     └──────────────┘
```

---

## Smart Contract (Anchor — Solana)

**Program ID:** `GdsJcVVwzv8sMwyYuKXgKiYouPUEBPHQS54xD4Rd1kDh`

Deployed on Solana Devnet with 15 instructions:

| Category | Instructions |
|----------|-------------|
| **Core** | `initialize_global`, `register_model`, `update_model` |
| **Inference** | `request_inference`, `complete_inference`, `request_inference_subscribed` |
| **Revenue** | `distribute_revenue`, `claim_revenue`, `claim_node_revenue` |
| **Ownership** | `transfer_ownership`, `list_for_sale`, `buy_model`, `add_contributor` |
| **Network** | `register_node`, `create_subscription` |

### Key On-Chain Features

- **Ownership NFTs** — Token-2022 mint PDA per model; single token represents ownership
- **Revenue Split** — 70% contributor / 25% compute node / 5% protocol
- **Contributor Shares** — `add_contributor` distributes revenue among multiple wallets
- **List/Buy Flow** — `buy_model` requires dual-wallet signing (buyer + current_owner)
- **12 models registered** on-chain (IDs 0–11), all with IPFS CIDs and on-chain metadata

### Account Structures

```
GlobalState: { bump, model_counter }
ModelRegistry: { owner, ipfs_cid, encryption_key_hash, task_type, accuracy_claim,
                 price_per_use, subscription_price, ownership_token_mint,
                 is_listed_for_sale, sale_price, contributors[], contribution_shares[],
                 inference_count, reputation_score, is_active }
```

---

## Backend (FastAPI + ONNX)

3 active ONNX models with real inference:

| Model | Task | Input Shape | Accuracy |
|-------|------|-------------|----------|
| MNIST Classifier | Classification | `[None, 784]` | **96.5%** |
| Sentiment Analyzer | Sentiment | `[None, 5000]` | Functional |
| Summarizer | Summarization | `[None, 114]` | Functional |

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /v1/models` | List all models with ownership/sale data |
| `GET /v1/discover` | Filter by task type, accuracy, sort |
| `POST /v1/inference/{id}` | Run inference (x402 payment flow) |
| `GET /v1/subscription/check` | Check subscription status |
| `POST /v1/models/upload` | Upload + encrypt model to IPFS |

### x402 Payment Flow

1. Client sends `POST /v1/inference/{id}` → receives **402 Payment Required**
2. Client sends SOL transfer to escrow address
3. Client retries request with `X-Payment: <tx_signature>` header
4. Backend verifies on-chain payment, runs inference, returns result + TEE attestation

### Dynamic Model Resolution

Models registered after the initial 12 use on-chain `task_type` field for runtime resolution:
- `classification → mnist`, `sentiment → sentiment`, `summarization → summarizer`

---

## Frontend (Next.js + Solana Wallet Adapter)

Dark brutalist theme with neon accents (indigo/violet/emerald). Features:

- **Marketplace** — Filter by task type, accuracy, sort. Buy listed models with dual-wallet flow
- **Model Detail** — Stats, IPFS CID, contributors list, owner actions (transfer, list for sale, add contributor)
- **Inference Page** — Canvas input (MNIST), text input (sentiment/summarizer), x402 payment
- **Upload Wizard** — 4-step: model file → metadata → encryption → on-chain registration
- **Dashboard** — Model stats, recent inference history
- **CogniStream Simulator** — Animated inference flow visualization

### Ownership Transfer Flow

1. **List for Sale** — Owner sets SOL price → on-chain `list_for_sale` tx → Solscan link
2. **Buy Model** — 3-step dual-wallet: buyer signs → switch to owner wallet → owner signs → tx sent
3. **Transfer Ownership** — Owner enters new wallet address → Token-2022 NFT transfer → Solscan link
4. **Add Contributor** — Owner enters wallet + share % → on-chain `add_contributor` tx

---

## Proof of Implementation

### On-Chain Proof
- **Program:** `GdsJcVVwzv8sMwyYuKXgKiYouPUEBPHQS54xD4Rd1kDh` on Devnet
- **12 models registered** with real IPFS CIDs and Token-2022 ownership mints
- **Ownership NFTs** exist for models 3–12 (Token-2022 program: `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`)
- All transactions viewable on [Solscan Devnet](https://solscan.io)

### Inference Proof
- Real ONNX models running on FastAPI backend
- 42/42 automated E2E tests passing (see `test_e2e.sh`)
- x402 payment verification with on-chain signature check
- TEE attestation hash returned with every inference result

### Test Coverage
```
Phase 1: GET /v1/models (13 models, ownership fields)
Phase 2: GET /v1/discover (filters, sorting)
Phase 3: POST /v1/inference (x402 flow, dynamic resolution)
Phase 4: GET /v1/subscription/check
Phase 5: POST /v1/models/upload
Phase 6: GlobalState cache TTL
Phase 7: Frontend page loads (7 pages)
Phase 8: yarn build (0 errors)
Phase 9: Frontend-Backend data consistency
Result: 42 PASSED, 0 FAILED
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | Anchor (Solana), Token-2022 |
| Backend | FastAPI, ONNX Runtime, httpx |
| Frontend | Next.js 16, Turbopack, Framer Motion |
| Wallet | @solana/wallet-adapter (Phantom, Solflare) |
| Storage | IPFS (Pinata) |
| Payment | x402 Protocol, SOL transfers |
| Attestation | TEE attestation hashes |

---

## Project Structure

```
├── vault/                          # Anchor program (Solana)
│   └── programs/vault/src/
│       ├── lib.rs                   # 15 instructions
│       ├── state/model_registry.rs  # Account structs
│       └── constants.rs             # Seeds, limits
│
├── vault-backend/                  # FastAPI backend
│   ├── main.py                      # App entry + routers
│   ├── routers/
│   │   ├── discovery.py             # Model listing + ownership data
│   │   ├── inference.py             # ONNX inference + x402
│   │   └── upload.py                # IPFS upload + encrypt
│   ├── services/
│   │   ├── onnx_runner.py           # 3 ONNX models
│   │   ├── solana.py                # PDA derivation + Borsh parser
│   │   └── solana_verifier.py       # Payment verification
│   └── middleware/
│       ├── x402.py                  # Payment details
│       └── tee_attestation.py       # TEE hashes
│
├── vault-frontend/                 # Next.js frontend
│   └── src/
│       ├── app/
│       │   ├── marketplace/         # Model grid + buy
│       │   ├── models/[id]/         # Detail + owner actions
│       │   ├── inference/           # Run inference
│       │   ├── upload/              # 4-step wizard
│       │   └── dashboard/          # Stats
│       ├── lib/
│       │   ├── api/backend.ts       # API client + types
│       │   └── solana/
│       │       ├── register-model.ts
│       │       ├── transfer-ownership.ts
│       │       ├── list-for-sale.ts
│       │       ├── buy-model.ts
│       │       └── add-contributor.ts
│       └── components/ui/           # 9 brutalist components
│
└── test_e2e.sh                     # 42-test automated suite
```

---

## Quick Start

### Prerequisites
- Node.js 18+, Python 3.11+, Yarn
- Solana CLI + Anchor CLI (for program deployment)
- Phantom or Solflare wallet

### Backend
```bash
cd vault-backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Add .env with SOLANA_RPC_URL, PINATA_API_KEY, PINATA_SECRET
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd vault-frontend
yarn install
# Add .env.local with NEXT_PUBLIC_SOLANA_RPC, NEXT_PUBLIC_PROGRAM_ID, NEXT_PUBLIC_BACKEND_URL
yarn dev --port 3000
```

---

## Key Constants

| Constant | Value |
|----------|-------|
| Program ID | `GdsJcVVwzv8sMwyYuKXgKiYouPUEBPHQS54xD4Rd1kDh` |
| Token-2022 Program | `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` |
| ATA Program | `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL` |
| Network | Solana Devnet |

---

## Team

**Abhishek Santosh Tiwari** — Full Stack + Solana Development

*DJ Sanghvi Synergy 3.0 | MagicBlock V4*
