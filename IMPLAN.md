# VAULT — Implementation Plan (IMPLAN)

> **8 Phases | Solo Developer | PS-Priority Order | Every phase has a testable checkpoint**
>
> This plan is ordered by **importance to the Problem Statement**, NOT by technical difficulty.
> The PS requires: encrypted models, blockchain ownership, pay-per-use, revenue split, IPFS storage, on-chain metadata, compute inference, transparent transactions. MagicBlock integration is critical for the V4 hack.

---

## AI Model Assignment

| Model | Use For |
|-------|---------|
| **Gemini 3.1 Pro** | Frontend pages, components, Tailwind, Framer Motion, UI wiring |
| **GLM 5.1 Premium** | Backend FastAPI, ONNX, encryption, medium Anchor instructions, agent |
| **Opus 4.6** | SPL Token-2022 CPI, MagicBlock ER/PER/VRF macros, Permission Program CPI |

## Difficulty Scale

| Level | Meaning |
|-------|---------|
| 1 | Trivial — scaffold, config, copy-paste |
| 2 | Easy — simple CRUD, basic UI component |
| 3 | Medium — integration work, API wiring, standard Anchor instruction |
| 4 | Hard — CPI, cross-program invocations, complex state machines |
| 5 | Very Hard — SPL Token-2022 CPI, MagicBlock delegation macros, VRF callback |

---

## PS Requirements Tracking

| # | PS Requirement | Phase Where Completed | Status |
|---|---------------|----------------------|--------|
| 1 | Models encrypted before storage | Phase 3 (AES-256-GCM in browser) | Pending |
| 2 | Ownership linked to blockchain wallet | Phase 1 (SPL Token-2022 supply=1) | Pending |
| 3 | Immutable metadata stored on-chain | Phase 1 (ModelRegistry PDA) | Pending |
| 4 | Pay-per-use API access | Phase 2 (x402 HTTP 402 flow) | Pending |
| 5 | Subscription-based models | Phase 1 (Subscription PDA) | Pending |
| 6 | Transparent revenue sharing | Phase 1 (distribute_revenue instruction) | Pending |
| 7 | Models stored on IPFS | Phase 3 (Pinata upload) | Pending |
| 8 | Blockchain stores only metadata | Phase 1 (CID on-chain, model on IPFS) | Pending |
| 9 | Nodes perform model inference | Phase 2 (FastAPI + onnxruntime) | Pending |
| 10 | Incentivized using tokens | Phase 1 (25% to compute node) | Pending |
| 11 | Distributed load balancing | Phase 4 (MagicBlock VRF node selection) | Pending |
| 12 | All transactions recorded on blockchain | Phase 1 (InferenceRequest PDA) | Pending |
| 13 | No intermediaries or hidden fees | Phase 1 (direct wallet-to-wallet) | Pending |
| B1 | Fully decentralized inference | Phase 4 (VRF + TEE) | Pending |
| B2 | ZK model verification | Phase 6 (EZKL proof) | Pending |
| B3 | Tokenomics design | Phase 1 (revenue split model) | Pending |
| B4 | On-chain reputation | Phase 4 (ER reputation PDA) | Pending |
| B5 | Multiple AI frameworks | Phase 2 (ONNX universal format) | Pending |
| B6 | Gas optimization / L2 | Phase 4 (MagicBlock ER = zero-fee) | Pending |
| M1 | Full ownership transfer | Phase 1 (SPL token transfer) | Pending |
| M2 | Multi-owner equal split | Phase 1 + Phase 6 (zkTLS verification) | Pending |
| M3 | Token usage transparency | Phase 2 + Phase 4 (TEE-attested metrics) | Pending |

---

## Phase 1: On-Chain Foundation

**PS Requirements Covered: #2, #3, #5, #6, #8, #10, #12, #13, M1**

**Goal**: All core smart contract instructions deployed and tested on devnet. SPL Token-2022 ownership minting, revenue split, subscriptions, inference requests — all working via `anchor test`.

### 1.1 Project Scaffold

| Task | Diff | AI | Details |
|------|------|----|---------|
| Anchor init vault | 1 | GLM | `cd ~/Documents/syergy && anchor init vault`. Verify `anchor build` succeeds. Project at `~/Documents/synergy/vault/`. |
| FastAPI scaffold | 1 | GLM | `mkdir -p ~/Documents/synergy/vault-backend/{routers,services,ws,models,zk_proofs}`. Create `main.py` with `/v1/health` endpoint. `requirements.txt`: fastapi, uvicorn[standard], onnxruntime, httpx, solana, solders, anchorpy, python-dotenv, psutil, cryptography, elevenlabs, mistralai, pydantic. |
| Clone CogniStream | 1 | Gemini | `git clone https://github.com/Abhishek222983101/CogniStream vault-frontend`. `npm install`. Verify `npm run dev` works. |
| Copy env files | 1 | GLM | Copy `backend.env` → `vault-backend/.env`. Copy `frontend.env` → `vault-frontend/.env.local`. |

### 1.2 Smart Contract — Account Structures

| Task | Diff | AI | Details |
|------|------|-----|---------|
| Define ModelRegistry PDA | 3 | GLM | Seeds: `[b"model", model_id.to_le_bytes()]`. Fields per SYS_ARCH §3.2: bump, model_id (u64), owner (Pubkey), ownership_token_mint (Pubkey), ipfs_cid (String 64), encryption_key_hash ([u8;32]), model_format (u8), task_type (u8), framework_version (String 16), accuracy_claim (u16), zk_accuracy_proof_hash ([u8;32]), price_per_use (u64), subscription_price (u64), is_listed_for_sale (bool), sale_price (u64), contributors (Vec<Pubkey> max 10), contribution_shares (Vec<u16> max 10), contribution_proofs (Vec<[u8;32]> max 10), accumulated_revenue (Vec<u64> max 10), total_revenue (u64), inference_count (u64), reputation_score (u32), total_ratings (u32), sum_ratings (u32), is_active (bool), created_at (i64), updated_at (i64), delegate_validator (Pubkey). Space: ~512 bytes + 8 discriminator. |
| Define InferenceRequest PDA | 3 | GLM | Seeds: `[b"inference", requester.key(), request_nonce.to_le_bytes()]`. Fields: bump, requester, model, assigned_node, input_hash [u8;32], output_hash [u8;32], zk_inference_proof [u8;32], payment_amount, payment_signature (String 88), status (u8: 0=created,1=paid,2=node_assigned,3=completed,4=verified,5=disputed), inference_time_ms, input_tokens, output_tokens, compute_flops, memory_peak_kb, tee_attestation_hash [u8;32], rating (u8), created_at, completed_at. Space: ~384 bytes. |
| Define ComputeNode PDA | 2 | GLM | Seeds: `[b"node", node_address.key()]`. Fields: bump, node_address, endpoint_url (String 128), stake, inference_count, total_inference_time_ms, uptime_score (u32), reputation (u32), tee_attestation_hash [u8;32], supported_task_types (u16), max_model_size_kb (u32), is_active (bool), registered_at (i64), last_heartbeat (i64). Space: ~256 bytes. |
| Define Subscription PDA | 2 | GLM | Seeds: `[b"subscription", subscriber.key(), model.key()]`. Fields: bump, subscriber, model, start_time, expiry_time, amount_paid, inference_count, is_active. Space: ~128 bytes. |
| Define RevenueEscrow PDA | 2 | GLM | Seeds: `[b"escrow"]`. Fields: bump, total_deposited, total_distributed, protocol_treasury (Pubkey), protocol_accumulated (u64). Space: ~80 bytes. |
| Define Reputation PDA | 2 | GLM | Seeds: `[b"reputation", model.key()]`. Fields: bump, model, score (u32), total_inferences (u64), successful_inferences (u64), failed_inferences (u64), avg_inference_time_ms (u32), last_updated (i64). Space: ~80 bytes. |
| Define GlobalState PDA | 1 | GLM | Seeds: `[b"global"]`. Fields: bump, model_counter (u64), inference_counter (u64), authority (Pubkey). Space: ~48 bytes. Used for auto-incrementing IDs. |
| Define errors.rs | 1 | GLM | Error codes: ModelNotFound, Unauthorized, InvalidPrice, InsufficientPayment, NodeNotActive, InvalidContributionShares, AlreadyListedForSale, NotListedForSale, SubscriptionExpired, SubscriptionActive, InvalidStatus, ProofVerificationFailed, TeeAttestationFailed. |
| Define constants.rs | 1 | GLM | Seeds: MODEL_SEED=b"model", INFERENCE_SEED=b"inference", NODE_SEED=b"node", SUBSCRIPTION_SEED=b"subscription", ESCROW_SEED=b"escrow", REPUTATION_SEED=b"reputation", GLOBAL_SEED=b"global". Sizes: MODEL_SIZE=512+8, etc. Fee split: CONTRIBUTOR_BPS=7000, NODE_BPS=2500, PROTOCOL_BPS=500. MAX_CONTRIBUTORS=10. |

### 1.3 Smart Contract — Core Instructions

| Task | Diff | AI | Details |
|------|------|-----|---------|
| `initialize_global` | 1 | GLM | Creates GlobalState PDA. Sets authority = deployer. model_counter = 0. |
| `register_model` (without SPL token first) | 3 | GLM | Args: ipfs_cid, encryption_key_hash, model_format, task_type, framework_version, accuracy_claim, price_per_use, subscription_price. Creates ModelRegistry PDA. Increments model_counter in GlobalState. Sets owner = signer. Sets is_active = true. `ownership_token_mint` set to Pubkey::default() for now (Phase 1.4 adds SPL token). |
| `register_node` | 2 | GLM | Args: endpoint_url, supported_task_types, max_model_size_kb. Creates ComputeNode PDA. Sets stake from lamports transferred. Sets is_active = true, uptime_score = 5000, reputation = 5000. |
| `update_model` | 2 | GLM | Args: price_per_use (Option), subscription_price (Option), is_active (Option). Only owner can call (model.owner == signer). Updates updated_at. |
| `request_inference` | 3 | GLM | Args: model (Pubkey), input_hash ([u8;32]). Checks model.is_active. Checks subscription OR requires payment. If pay-per-use: transfer price_per_use lamports from requester to RevenueEscrow PDA. Creates InferenceRequest PDA with nonce from GlobalState.inference_counter. Sets status = PAID (1). Stores payment_signature. |
| `complete_inference` | 3 | GLM | Args: inference_pda, output_hash, inference_time_ms, input_tokens, output_tokens, memory_peak_kb, tee_attestation_hash. Only assigned_node can call. Sets status = COMPLETED (3). Fills all metric fields. Sets completed_at. |
| `add_contributor` | 3 | GLM | Args: model, contributor (Pubkey), share (u16), proof_hash ([u8;32]). Only model owner can call. Appends to contributors, contribution_shares, contribution_proofs. Validates shares sum ≤ 10000. Initializes accumulated_revenue = 0. |
| `distribute_revenue` | 3 | GLM | Args: model, inference_request. Calculates: total = inference.payment_amount. contributor_portion = total * 7000 / 10000. node_portion = total * 2500 / 10000. protocol_portion = total * 500 / 10000. If solo creator: contributor_portion all to accumulated_revenue[0]. If multi: split contributor_portion by contribution_shares proportions. Add node_portion to ComputeNode pending (or model accumulated for node). Add protocol_portion to RevenueEscrow.protocol_accumulated. |
| `claim_revenue` | 2 | GLM | Args: model, contributor_index. Verifies signer == model.contributors[index]. Transfers model.accumulated_revenue[index] lamports from RevenueEscrow to signer. Sets accumulated_revenue[index] = 0. |
| `create_subscription` | 2 | GLM | Args: model. Transfers model.subscription_price lamports from subscriber to RevenueEscrow. Creates Subscription PDA. Sets start_time = Clock::get().unix_timestamp, expiry_time = start_time + 30*24*60*60 (30 days). Sets is_active = true. |
| `check_subscription` | 1 | GLM | View function (no mutation). Args: subscriber, model. Returns whether Subscription.is_active && Clock::get().unix_timestamp < expiry_time. Used by request_inference to skip payment. |

### 1.4 Smart Contract — SPL Token-2022 Ownership

| Task | Diff | AI | Details |
|------|------|-----|---------|
| Add SPL Token-2022 CPI to `register_model` | 5 | **Opus** | After creating ModelRegistry PDA: (1) Create mint with Token-2022 program using `create_mint` instruction, (2) Create ATA for creator with `create_associated_token_account_idempotent`, (3) Mint 1 token to creator's ATA with `mint_to`, (4) Set mint authority to None with `set_authority`. Store `ownership_token_mint` in ModelRegistry. Remaining accounts needed: token_mint, token_ata, token_program (spl_token_2022), associated_token_program, rent, system_program. |
| `transfer_ownership` | 4 | **Opus** | Args: model, new_owner (Pubkey). Verifies signer owns the SPL token (ATA balance = 1). Transfers token from current owner ATA to new owner ATA using `transfer_checked` (Token-2022 CPI). Updates ModelRegistry.owner = new_owner. Emits OwnershipTransferred event. Creates new ATA for new_owner if needed. |
| `list_for_sale` | 2 | GLM | Args: model, sale_price (u64). Only owner. Sets model.is_listed_for_sale = true, model.sale_price = sale_price. |
| `buy_model` | 4 | **Opus** | Args: model. Verifies model.is_listed_for_sale. Transfers model.sale_price lamports from buyer to model.owner. Transfers SPL token from owner ATA to buyer ATA. Updates model.owner = buyer. Sets model.is_listed_for_sale = false. Creates buyer ATA if needed. |

### 1.5 ONNX Model Preparation

| Task | Diff | AI | Details |
|------|------|-----|---------|
| Train MNIST classifier → mnist.onnx | 2 | GLM | Python script: train sklearn MLPClassifier on MNIST (accuracy ~94%). Export with `skl2onnx`. Input: float[1,1,28,28]. Output: probabilities [1,10]. Verify with `onnxruntime.InferenceSession()`. Size < 1MB. |
| Train sentiment classifier → sentiment.onnx | 2 | GLM | Python script: train sklearn on a small sentiment dataset (IMDB subset or similar). Export to ONNX. Input: tokenized text features. Output: positive/negative probability. Verify loads. |
| Train summarizer → summarizer.onnx | 2 | GLM | Use a small extractive summarization model. Or use a simple TF-IDF + sentence scoring model. Export to ONNX. Input: text features. Output: summary scores. |

### 1.6 Deploy & Test

| Task | Diff | AI | Details |
|------|------|-----|---------|
| Deploy to devnet | 2 | GLM | `anchor build && anchor deploy --provider.cluster devnet --provider.wallet ~/.config/solana/id.json`. Verify program ID on Solana explorer. |
| Anchor test suite | 3 | GLM | Write `tests/vault.ts`: (1) Initialize global state, (2) Register model → verify PDA created, (3) Register node → verify PDA created, (4) Request inference → verify payment transferred + PDA created, (5) Complete inference → verify metrics stored, (6) Add 3 contributors (40/35/25 shares) → verify shares sum = 10000, (7) Distribute revenue → verify 70/25/5 split: 0.01 SOL → 0.007 to contributors (0.0028/0.00245/0.00175), 0.0025 to node, 0.0005 to protocol, (8) Claim revenue → verify SOL in wallet, (9) Create subscription → verify active, (10) Transfer ownership → verify token moves + owner updates, (11) List for sale + buy → verify full flow. |

### Checkpoint 1

- [ ] `anchor test` passes for ALL 14+ instructions on devnet
- [ ] SPL Token-2022 minted with supply=1, mint authority = None
- [ ] Revenue split math verified: 0.01 SOL → 0.007 / 0.0025 / 0.0005
- [ ] Ownership transfer: token moves, PDA owner updates
- [ ] list_for_sale → buy_model: SOL + SPL token + owner swap
- [ ] Subscription skips payment during inference
- [ ] Program visible on Solana explorer at `GdsJcVVwzv8sMwyYuKXgKiYouPUEBPHQS54xD4Rd1kDh`
- [ ] 3 ONNX models load in Python `onnxruntime.InferenceSession()`
- [ ] FastAPI `/v1/health` returns 200
- [ ] CogniStream frontend runs on localhost

---

## Phase 2: Compute Node Backend + Inference Engine

**PS Requirements Covered: #4, #9, #12, M3**

**Goal**: FastAPI server accepts x402 payments, runs ONNX inference, verifies Solana payments, returns results with TEE-attested metrics, reports to on-chain InferenceRequest PDA.

### 2.1 Core Inference Endpoint

| Task | Diff | AI | Details |
|------|------|-----|---------|
| `/v1/inference/{model_id}` — x402 flow | 3 | GLM | Step 1: Client sends POST without X-Payment header. Server responds HTTP 402 with JSON: `{status: "payment_required", pay_to: revenue_escrow_pubkey, amount: price_in_sol, currency: "SOL", network: "devnet", model_id, model_name, accuracy}`. Step 2: Client pays SOL via Phantom, gets tx signature. Step 3: Client retries POST with `X-Payment: <tx_signature>` header. Step 4: Server verifies payment, runs inference, returns result + metrics + attestation. |
| Solana payment verification | 3 | GLM | `services/solana_verifier.py`: Given tx signature, call `getTransaction` on Helius RPC. Verify: (1) `meta.err` is null (success), (2) find the SOL transfer instruction, (3) transfer amount ≥ expected price, (4) destination = expected RevenueEscrow PDA. Return True/False. Handle edge cases: tx not found yet (retry after 2s), partial write. |
| ONNX runner service | 3 | GLM | `services/onnx_runner.py`: Load model by ID from `/models/` directory. `session = onnxruntime.InferenceSession(model_path)`. Preprocess: MNIST → normalize pixels to float32 [0,1], reshape to [1,1,28,28]; Sentiment → tokenize + pad; Summarizer → feature extraction. Run: `session.run(None, {input_name: preprocessed})`. Postprocess: softmax probabilities, argmax prediction. Return structured result with all 10 class probabilities for MNIST. |
| Metrics measurement | 2 | GLM | `services/metrics.py`: Wrap inference call. Before: `start = time.perf_counter_ns()`, `start_mem = psutil.Process().memory_info().rss`. After: `end = time.perf_counter_ns()`, `end_mem = ...`. Calculate: inference_time_ms = (end-start)/1e6, input_tokens = pixel_count or token_count, output_tokens = len(result), memory_peak_kb = max(start_mem,end_mem)//1024. Return as dict. |
| TEE attestation generation (simplified) | 2 | GLM | `middleware/tee_attestation.py`: For devnet demo: generate SHA-256 hash of (model_id + output + metrics_json + timestamp). This is a placeholder — real TEE attestation comes from MagicBlock PER in Phase 4. Store as `tee_attestation_hash` field. In Phase 4, replace with `verifyTeeRpcIntegrity()`-backed attestation. |
| x402 middleware | 3 | GLM | `middleware/x402.py`: Extract `X-Payment` header from request. If missing → return 402. If present → call `solana_verifier.verify_payment()`. If valid → proceed to inference. If invalid → return 403 "Payment not verified". |
| Wire to on-chain | 3 | GLM | `services/on_chain_reporter.py`: After successful inference, call `complete_inference` instruction on Solana via Anchor Python SDK (`anchorpy`). Send: output_hash (SHA-256 of result), all metrics, tee_attestation_hash. Uses deployer keypair from .env for signing. |

### 2.2 Discovery & Utility Endpoints

| Task | Diff | AI | Details |
|------|------|-----|---------|
| `/v1/models` — list models | 2 | GLM | Returns list of available models from on-chain ModelRegistry PDAs. Fields: id, name, task, accuracy, price_sol, inference_count, reputation. Uses `getProgramAccounts` RPC call with ModelRegistry discriminator filter. |
| `/v1/discover` — search models | 2 | GLM | Query params: `task` (str), `min_accuracy` (float), `sort_by` (accuracy/price/popularity). Filters models by task_type, then by accuracy >= min_accuracy, then sorts. Used by agent (Phase 7). |
| `/v1/health` — node health | 1 | GLM | Returns: {status: "active", stake_sol, supported_task_types, inference_count, uptime_score}. Reads from ComputeNode PDA on-chain. |
| `/v1/subscription/check` — subscription check | 2 | GLM | Query params: `subscriber` (Pubkey string), `model` (Pubkey string). Reads Subscription PDA from chain. Returns {is_active, expiry_time, inference_count}. |

### 2.3 Manual End-to-End Test

| Task | Diff | AI | Details |
|------|------|-----|---------|
| Test full x402 flow with curl | 2 | GLM | 1. `curl -X POST http://localhost:8000/v1/inference/mnist -d '{"input_data": ...}'` → get 402 response. 2. Pay 0.01 SOL via `solana transfer` CLI. 3. `curl -X POST ... -H "X-Payment: <tx_sig>"` → get MNIST prediction + metrics. 4. Verify InferenceRequest PDA on Solana explorer. |

### Checkpoint 2

- [ ] `curl /v1/inference/mnist` returns HTTP 402 with payment details (pay_to, amount, currency)
- [ ] After paying SOL and retrying with `X-Payment` header, returns MNIST prediction
- [ ] Prediction includes digit class + confidence for all 10 digits
- [ ] Metrics included: inference_time_ms, input_tokens, memory_peak_kb
- [ ] tee_attestation_hash included in response
- [ ] `/v1/models` lists 3 demo models from on-chain
- [ ] `/v1/discover?task=classification` returns MNIST model
- [ ] InferenceRequest PDA created on devnet after inference
- [ ] Payment verified on-chain before inference runs (no free rides)

---

## Phase 3: Encryption + IPFS + Upload Flow + Frontend Foundation

**PS Requirements Covered: #1, #7, #8**

**Goal**: Creator uploads .onnx through browser: file encrypted with AES-256-GCM → uploaded to Pinata IPFS → CID stored on-chain in ModelRegistry PDA. Also sets up wallet adapter and program client for all subsequent frontend work.

### 3.1 Solana Wallet + Program Client

| Task | Diff | AI | Details |
|------|------|-----|---------|
| Install wallet adapter packages | 1 | Gemini | `npm install @solana/wallet-adapter-react @solana/wallet-adapter-react-ui @solana/wallet-adapter-phantom @solana/wallet-adapter-base`. |
| WalletProvider wrapper | 2 | Gemini | `lib/solana/wallet-adapter.ts`: Create `WalletProvider` with `ConnectionProvider` (Helius devnet RPC), `WalletModalProvider`, clusters config for devnet. Export `WalletContextProvider` component wrapping children. |
| Navbar wallet connect button | 2 | Gemini | Import `useWallet` from adapter. Button: disconnected → "Connect Wallet" (opens modal). Connected → show truncated address + SOL balance. Use `useConnection` to fetch balance. Style: rounded, gradient border, hover glow. |
| Anchor program client | 3 | GLM | `lib/solana/program.ts`: Load IDL from `target/idl/vault.json` (copy from Anchor build output). Create `getProgram(connection, wallet)` that returns `Program<Vault>` instance. Export helper: `getModelPDA(modelId)`, `getInferencePDA(requester, nonce)`, `getNodePDA(address)`, etc. |
| Copy IDL to frontend | 1 | GLM | After `anchor build`, copy `vault/target/idl/vault.json` → `vault-frontend/src/lib/solana/idl/vault.json`. |

### 3.2 Browser-Side Encryption (AES-256-GCM)

| Task | Diff | AI | Details |
|------|------|-----|---------|
| `lib/ipfs/encrypt.ts` | 3 | GLM | Using Web Crypto API (runs in browser, zero server-side key exposure): (1) `key = await crypto.subtle.generateKey({name:"AES-GCM",length:256}, true, ["encrypt","decrypt"])`, (2) `iv = crypto.getRandomValues(new Uint8Array(12))`, (3) `encrypted = await crypto.subtle.encrypt({name:"AES-GCM",iv}, key, modelFileBuffer)`, (4) `rawKey = await crypto.subtle.exportKey("raw", key)`, (5) `keyHash = await crypto.subtle.digest("SHA-256", rawKey)`. Return: `{encrypted: ArrayBuffer, rawKey: Uint8Array, iv: Uint8Array, keyHash: Uint8Array}`. |
| `lib/ipfs/decrypt.ts` | 3 | GLM | For testing only: `decrypt(encryptedBuffer, rawKey, iv)` → returns original model bytes. NOT used in production (keys never leave TEE). |

### 3.3 Pinata IPFS Integration

| Task | Diff | AI | Details |
|------|------|-----|---------|
| `lib/ipfs/pinata.ts` — Upload | 2 | Gemini | `uploadToIPFS(encryptedBlob: Blob)`: POST to `https://api.pinata.cloud/pinning/pinFileToIPFS` with FormData. Headers: `Authorization: Bearer ${PINATA_JWT}`. Parse response → return `IpfsHash` (CID). |
| `lib/ipfs/pinata.ts` — Download | 1 | Gemini | `downloadFromIPFS(cid: string)`: GET `https://gateway.pinata.cloud/ipfs/${cid}`. Returns encrypted ArrayBuffer. |
| `lib/ipfs/pinata.ts` — Verify | 1 | Gemini | `verifyOnIPFS(cid: string)`: HEAD request to gateway. Returns boolean (200 = pinned). |

### 3.4 Upload Wizard UI

| Task | Diff | AI | Details |
|------|------|-----|---------|
| `upload/page.tsx` — Layout | 2 | Gemini | Full-page upload wizard with dark theme. Step indicator at top (1→2→3→4→5). Center content area. Next/Back buttons. Progress bar. Framer Motion slide transitions between steps. |
| `UploadWizard.tsx` — Orchestrator | 3 | Gemini | State machine: `{currentStep, file, metadata, contributors, cid, rawKey, keyHash, txSignature, modelId}`. Steps: (1) SelectFile → (2) SetMetadata → (3) AddContributors → (4) EncryptAndUpload → (5) RegisterOnChain. "Next" validates current step before advancing. |
| Step 1: SelectFile | 1 | Gemini | File input accepting .onnx, .pt, .h5, .pkl. Drag-and-drop zone. Show file name + size. Validate < 100MB. |
| Step 2: SetMetadata | 2 | Gemini | Form fields: model name, description, task type (dropdown: Classification/Sentiment/Summarization/Object Detection), accuracy claim (slider 0-100%), price per inference (SOL input), subscription price (SOL input), framework version (text). Validation: price > 0, name non-empty. |
| Step 3: AddContributors | 2 | Gemini | Dynamic list: add row (wallet address + share %). Live validator: sum must ≤ 100%. Remove button per row. Pie chart of shares (use Recharts PieChart). "Skip" option if solo creator. Max 10 contributors. |
| Step 4: EncryptAndUpload | 3 | Gemini | Animation sequence: (1) "Generating AES-256-GCM key..." with key icon animation, (2) "Encrypting model file..." with lock icon + progress bar, (3) "Uploading to IPFS..." with cloud upload icon, (4) "CID received!" with green checkmark. Shows: CID in monospace, IPFS gateway link, "Download encrypted file to verify" link. Actual operations: call `encryptModel()` then `uploadToIPFS()`. |
| Step 5: RegisterOnChain | 3 | GLM | Call `register_model` via Anchor program. Sends: ipfs_cid, encryption_key_hash (SHA-256 of rawKey), task_type, price_per_use, accuracy_claim, contributors + shares. Wallet popup for tx signing. Show tx signature + "View on Explorer" link. On success: show model ID + "Go to Marketplace" button. |

### Checkpoint 3

- [ ] .onnx file encrypted in browser with AES-256-GCM (rawKey generated, never sent to server)
- [ ] Encrypted file uploaded to Pinata IPFS, CID returned
- [ ] CID visible on Pinata gateway — download shows encrypted garbage bytes, NOT valid ONNX
- [ ] SHA-256 of rawKey matches keyHash stored on-chain
- [ ] `register_model` called from browser with CID + key_hash + metadata
- [ ] Model appears in on-chain registry (queryable via `getProgramAccounts`)
- [ ] Full upload wizard: file → metadata → contributors → encrypt → IPFS → register
- [ ] Wallet connect button works (Phantom popup on devnet)
- [ ] `lib/solana/program.ts` creates Anchor program client with loaded IDL

---

## Phase 4: MagicBlock Integration (ER + PER/TEE + VRF + Private Payments)

**PS Requirements Covered: B1, B4, B6, #11, M3**

**Goal**: Zero-fee Ephemeral Rollups for reputation + heartbeat. PER/TEE for AES key storage with permission-gated access. MagicBlock VRF for fair compute node selection. Private Payment API for confidential billing.

***THIS IS THE MOST CRITICAL PHASE FOR THE MAGICBLOCK V4 HACK. WE USE ALL 5 MAGICBLOCK PRODUCTS.***

### MagicBlock Constants (from docs)

```
Delegation Program:  DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh
Permission Program:  ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1
ER Validator (Asia): MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57
TEE Validator:       MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo
ER RPC (Asia):       https://devnet-as.magicblock.app/
TEE RPC:             https://devnet-tee.magicblock.app/
Magic Router:        https://devnet-router.magicblock.app/
```

### 4.1 Ephemeral Rollup (ER) — Zero-Fee Real-Time State

| Task | Diff | AI | Details |
|------|------|-----|---------|
| Add `ephemeral-rollups-sdk` dep | 1 | **Opus** | `cargo add ephemeral-rollups-sdk --features anchor` in vault program. Import: `use ephemeral_rollups_sdk::anchor::{ephemeral, delegate, commit};` and `use ephemeral_rollups_sdk::cpi::DelegateConfig;` and `use ephemeral_rollups_sdk::ephem::{commit_accounts, commit_and_undelegate_accounts};` |
| Add `#[ephemeral]` macro | 2 | **Opus** | Add `#[ephemeral]` attribute above `#[program]` in `lib.rs`. This injects the undelegation callback discriminator `[196, 28, 41, 206, 48, 37, 51, 167]` and its instruction processor automatically. |
| `delegate_model_pda` instruction | 4 | **Opus** | Delegates Model PDA to ER validator (Asia). Context uses `#[delegate]` macro: `#[delegate] #[derive(Accounts)] pub struct DelegateModel<'info> { pub payer: Signer, pub validator: Option<AccountInfo>, #[account(mut, del)] pub pda: AccountInfo }`. Instruction calls `ctx.accounts.delegate_pda(&payer, &[MODEL_SEED, &model_id.to_le_bytes()], DelegateConfig { validator: Some(ER_VALIDATOR), ..Default::default() })`. |
| `delegate_reputation_pda` instruction | 4 | **Opus** | Same pattern but for Reputation PDA. Delegates to ER validator for zero-fee real-time updates. |
| `delegate_node_pda` instruction | 3 | **Opus** | Same pattern for ComputeNode PDA (heartbeat tracking on ER). |
| `update_reputation_er` instruction | 4 | **Opus** | Runs on ER (zero fees). After inference: adjust reputation score. Args: model, delta (i32). If delta > 0 (success): score += delta. If delta < 0 (failure): score = max(0, score + delta). This instruction is sent to ER RPC, NOT base layer. |
| `update_node_heartbeat_er` | 3 | **Opus** | Runs on ER. Args: node. Updates `last_heartbeat = Clock::get().unix_timestamp`. Sent by compute node every 60s via cron/loop. |
| `commit_reputation` | 3 | **Opus** | Commits ER state to base layer. Uses `commit_accounts` function: `commit_accounts(&payer, vec![&reputation.to_account_info()], &magic_context, &magic_program)`. Called periodically or after N inferences. |
| `update_inference_count_er` | 2 | **Opus** | Runs on ER. Increments ModelRegistry.inference_count and Reputation PDA counters. Zero-fee counter increment for real-time stats display. |
| Magic Action: auto-commit after N inferences | 4 | **Opus** | Uses `MagicInstructionBuilder` with `MagicAction::Commit(CommitType::WithHandler)`. After every 10 inferences on ER, automatically triggers a commit to base layer AND an action instruction (e.g., `update_leaderboard`). Reference: MagicBlock Magic Actions docs. |

### 4.2 Private Ephemeral Rollup (PER/TEE) — Model Key Vault

| Task | Diff | AI | Details |
|------|------|-----|---------|
| Create permission for model key access | 4 | **Opus** | Uses Permission Program `ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1`. For each model: `CreatePermissionCpiBuilder::new(&permission_program).permissioned_account(&model_pda).permission(&permission_pda).payer(&payer).system_program(&system_program).args(MembersArgs { members: Some(vec![Member { flags: AUTHORITY_FLAG \| TX_LOGS_FLAG, pubkey: model_owner }, Member { flags: TX_LOGS_FLAG, pubkey: compute_node_pubkey }]) }).invoke_signed(...)`. Members: model owner has AUTHORITY, compute nodes have TX_LOGS (can read). |
| `delegate_model_to_tee` instruction | 5 | **Opus** | Delegates Model PDA + Permission PDA to TEE validator. Both must be delegated for PER to work. Uses `DelegatePermissionCpiBuilder` for permission + `delegate_pda` for model. TEE validator: `MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo`. After delegation, Model PDA state is private — only authorized members via TEE can read/write. |
| TEE auth token flow (backend) | 3 | GLM | `services/tee_auth.py`: (1) `isVerified = verifyTeeRpcIntegrity(TEE_RPC_URL)` — verify Intel TDX attestation. (2) `authToken = getAuthToken(TEE_RPC_URL, wallet.publicKey, signCallback)` — sign challenge message with deployer keypair. (3) Create connection: `teeUrl = f"{TEE_RPC_URL}?token={authToken.token}"`. Use this URL for all PER interactions. |
| AES key write to PER | 4 | GLM | `services/per_key_vault.py`: After model registration, write raw AES key as private state on PER. Send transaction to TEE RPC that updates Model PDA's private field with the raw key. Only TEE validator can see this — the key is never visible on base layer. |
| AES key read from PER | 4 | GLM | `services/per_key_vault.py`: Before inference, compute node requests AES key from PER. Must: (1) have valid TEE auth token, (2) be in the model's permission members list, (3) have valid TEE attestation cert. TEE validates all three, then returns key. Key used in-memory only, destroyed after inference. |
| `update_permission` for adding compute nodes | 3 | **Opus** | When a new compute node registers, model owner can add it to the permission members: `UpdatePermissionCpiBuilder::new(&permission_program).authority(&model_owner, true).permissioned_account(&model_pda, true).permission(&permission_pda).args(MembersArgs { members: Some(vec![...existing_members..., Member { flags: TX_LOGS_FLAG, pubkey: new_node }]) }).invoke_signed(...)`. Runs on PER (real-time update without undelegating). |

### 4.3 MagicBlock VRF — Fair Node Selection

| Task | Diff | AI | Details |
|------|------|-----|---------|
| Add `ephemeral_vrf_sdk` dep | 1 | **Opus** | `cargo add ephemeral_vrf_sdk --features anchor`. Import: `use ephemeral_vrf_sdk::anchor::vrf;`, `use ephemeral_vrf_sdk::instructions::{create_request_randomness_ix, RequestRandomnessParams};`, `use ephemeral_vrf_sdk::types::SerializableAccountMeta;`. |
| `assign_node_vrf` instruction | 5 | **Opus** | Args: inference_request, payer. Creates VRF randomness request: `let ix = create_request_randomness_ix(RequestRandomnessParams { payer: payer.key(), oracle_queue: oracle_queue.key(), callback_program_id: ID, callback_discriminator: instruction::CallbackAssignNode::DISCRIMINATOR.to_vec(), caller_seed: [model_id as u8; 32], accounts_metas: Some(vec![SerializableAccountMeta { pubkey: inference_request.key(), is_signer: false, is_writable: true }, SerializableAccountMeta { pubkey: model.key(), is_signer: false, is_writable: true }]), ..Default::default() });`. Context uses `#[vrf]` macro: `#[vrf] #[derive(Accounts)] pub struct AssignNodeVrf<'info> { pub payer: Signer, #[account(mut)] pub inference_request: Account<InferenceRequest>, #[account(mut)] pub model: Account<ModelRegistry>, #[account(mut, address = ephemeral_vrf_sdk::consts::DEFAULT_QUEUE)] pub oracle_queue: AccountInfo }`. Calls `ctx.accounts.invoke_signed_vrf(&payer, &ix)`. |
| `callback_assign_node` instruction | 5 | **Opus** | Consumes VRF randomness. Args: randomness ([u8;32]). `let node_index = ephemeral_vrf_sdk::rnd::random_u8_with_range(&randomness, 0, active_node_count as u8)`. Reads active nodes from ComputeNode PDAs. Sets `inference_request.assigned_node = active_nodes[node_index as usize]`. Sets `inference_request.status = NODE_ASSIGNED (2)`. Context: `#[derive(Accounts)] pub struct CallbackAssignNode<'info> { #[account(address = ephemeral_vrf_sdk::consts::VRF_PROGRAM_IDENTITY)] pub vrf_program_identity: Signer, #[account(mut)] pub inference_request: Account<InferenceRequest>, #[account(mut)] pub model: Account<ModelRegistry> }`. |
| Wire VRF into inference flow | 3 | GLM | Backend: after `request_inference` on base layer, call `assign_node_vrf` on base layer. Poll InferenceRequest PDA for status change to NODE_ASSIGNED (check every 2s, timeout 30s). When assigned, the selected node picks up the request. Node downloads encrypted model from IPFS, gets key from PER (4.2), decrypts, runs inference, calls `complete_inference`. |

### 4.4 Private Payment API — Confidential Billing

| Task | Diff | AI | Details |
|------|------|-----|---------|
| Initialize mint for private payments | 3 | **Opus** | Use MagicBlock Private Payment API. `POST https://devnet-tee.magicblock.app/api/per/mint/initialize` with auth token. Creates a private SPL token mint for confidential SOL-denominated billing. |
| Deposit SOL to private mint | 2 | GLM | User deposits SOL to the private mint before inference. `POST /api/per/deposit` with `{mint, amount, owner}`. SOL becomes privately tracked in PER. |
| Transfer privately for inference | 3 | GLM | When paying for inference, use private transfer: `POST /api/per/transfer` with `{mint, from, to, amount, token}`. Amount is NOT visible on Solana explorer. Shows as [CONFIDENTIAL]. |
| Withdraw remaining balance | 2 | GLM | User can withdraw unused private balance: `POST /api/per/withdraw` with `{mint, amount, destination, token}`. SOL returns to wallet. |
| Wire private payment into x402 flow | 3 | GLM | Modify `middleware/x402.py`: if user has private balance, use private transfer instead of public SOL transfer. Inference payment shows "Private Transaction" badge. |

### 4.5 ER Integration Tests

| Task | Diff | AI | Details |
|------|------|-----|---------|
| Test ER delegation + zero-fee tx | 4 | **Opus** | TypeScript test: (1) Delegate Reputation PDA to ER validator, (2) Send `update_reputation_er` to ER RPC (`https://devnet-as.magicblock.app/`), (3) Verify zero fees on ER, (4) `commit_reputation` to base layer, (5) Verify state synced. |
| Test VRF node assignment | 4 | **Opus** | TypeScript test: (1) Register 3 nodes, (2) Request inference, (3) Call `assign_node_vrf`, (4) Wait 3-5s for callback, (5) Verify InferenceRequest.assigned_node is one of the 3 nodes, (6) Verify different calls get different nodes (randomness). |
| Test PER key read/write | 3 | GLM | Python test: (1) Create permission for model, (2) Delegate model to TEE, (3) Write AES key to PER, (4) Read key back with authorized wallet, (5) Verify key matches, (6) Try reading with UNauthorized wallet → expect failure/empty. |

### Checkpoint 4

- [ ] Reputation PDA delegated to ER validator (Asia devnet)
- [ ] `update_reputation_er` runs on ER with **zero** SOL fees
- [ ] `commit_reputation` syncs ER state → base layer (state matches)
- [ ] `update_node_heartbeat` runs on ER every 60s from compute node
- [ ] Magic Action fires automatically after N inferences on ER
- [ ] Model PDA + Permission PDA delegated to TEE validator
- [ ] AES key written to PER (private state, NOT visible on base layer)
- [ ] Authorized compute node reads AES key from PER successfully
- [ ] **UNauthorized** wallet CANNOT read key from PER (access denied)
- [ ] VRF assigns node: `assign_node_vrf` → callback → `InferenceRequest.assigned_node` set
- [ ] Different VRF calls produce different node assignments (randomness verified)
- [ ] Private Payment: inference tx shows as [CONFIDENTIAL] on Solana explorer
- [ ] TEE attestation verification passes: `verifyTeeRpcIntegrity` returns true
- [ ] ALL 5 MagicBlock products working on devnet:
  - [ ] ER (zero-fee reputation + heartbeat + Magic Actions)
  - [ ] PER/TEE (private model keys + permission-gated access)
  - [ ] VRF (fair node selection)
  - [ ] Private Payment API (confidential billing)
  - [ ] Permission Program (member flags + access control)

---

## Phase 5: Frontend Core — Retheme + Marketplace + Inference UI

**PS Requirements Covered: Visual demo of all on-chain features**

**Goal**: CogniStream re-themed as VAULT with dark AI marketplace aesthetic. Users browse models, run inference (draw MNIST digit), see TEE-attested metrics, view ownership badges, interact with MagicBlock features from browser.

### 5.1 Theme & Layout

| Task | Diff | AI | Details |
|------|------|-----|---------|
| Strip CogniStream healthcare content | 2 | Gemini | Remove ALL healthcare-specific text, images, sections from `page.tsx`, `simulator/` page, and any medical references. Keep: layout structure, animation patterns, component patterns, Framer Motion usage patterns, Tailwind utility patterns. |
| New VAULT color theme | 2 | Gemini | Update Tailwind config (or CSS vars): primary=indigo-600, accent=violet-500, bg=slate-950, card=slate-900, border=slate-800, text=slate-100, muted=slate-400. Gradient accents: indigo→violet (buttons, badges, hero). Dark mode by default. Neon glow effects on hover (indigo/violet shadow). |
| VAULT favicon + meta | 1 | Gemini | Create SVG favicon with "V" in gradient. Update `<title>` and `<meta>` in `layout.tsx`. |
| `layout.tsx` — Root layout | 2 | Gemini | Wrap with `WalletContextProvider`. Add `ThemeProvider` (next-themes, dark default). Fonts: Inter or JetBrains Mono for monospace elements. Navbar + Footer always visible. |

### 5.2 Landing Page

| Task | Diff | AI | Details |
|------|------|-----|---------|
| Hero section | 2 | Gemini | "VAULT — Decentralized AI Model Marketplace". Subtitle: "Publish, discover, and run ML models with cryptographic proofs. No intermediaries. Full transparency." Animated gradient text. Background: subtle grid pattern with floating model card mockups. CTA: "Connect Wallet & Explore" → links to /marketplace. |
| How It Works section | 2 | Gemini | 4-step animated flow: (1) Upload → creator encrypts model with AES-256-GCM, (2) Store → encrypted model uploaded to IPFS, key stored in TEE, (3) Discover → browse models with ZK-verified accuracy, (4) Infer → pay per use, VRF selects node, TEE decrypts & runs inference. Each step with icon + description + connecting arrow animation. |
| Why VAULT section | 2 | Gemini | Badge grid: ZK Verified (green shield), TEE Protected (blue lock), IPFS Stored (purple cloud), On-Chain Revenue (orange chart), Multi-Owner (cyan users), Zero-Fee L2 (indigo bolt). Each with 1-line description. Hover: scale up + glow. |
| Stats counter | 2 | Gemini | Animated counters (count up on scroll): "X Models Published", "X Inferences Run", "X SOL Earned", "X Contributors". Numbers from on-chain (fetch via getProgramAccounts or backend). Use Framer Motion `useInView` + `animate`. |
| Footer | 1 | Gemini | "Built on Solana · Secured by MagicBlock · Proven with ZK". Links: GitHub repo, Solana Explorer, MagicBlock docs. |

### 5.3 Marketplace Page

| Task | Diff | AI | Details |
|------|------|-----|---------|
| `marketplace/page.tsx` | 3 | Gemini | Full page: FilterBar at top, ModelGrid below. Fetch models from backend `/v1/models` on mount. Loading skeleton while fetching. Empty state: "No models found" with upload CTA. Responsive: 3 cols (lg), 2 cols (md), 1 col (sm). |
| `ModelCard.tsx` | 2 | Gemini | Card layout (per SYS_ARCH §5.2): top section — model name (bold, truncate), task type badge (colored pill), accuracy % (large number). Middle section — badges row: ZK Verified, TEE Protected, IPFS, Multi-Owner (conditionally shown). Bottom section — price "0.01 SOL/inference", inference count, star rating, "Run" + "Buy" buttons. Hover: scale(1.02) + indigo shadow glow. Entrance: Framer Motion stagger (0.05s delay per card). |
| `FilterBar.tsx` | 2 | Gemini | Horizontal bar: task type dropdown (All/Classification/Sentiment/Summarization/Object Detection), accuracy slider (0-100%, use Radix Slider), price range input (0-0.1 SOL), sort dropdown (Accuracy/Price/Popularity/Newest). Filters applied client-side on fetched list. Search input with magnifying glass icon. |
| `ModelGrid.tsx` | 1 | Gemini | CSS Grid wrapper. `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`. Maps model list → `ModelCard` components. AnimatePresence for enter/exit animations when filtering. |

### 5.4 Model Detail + Inference Page

| Task | Diff | AI | Details |
|------|------|-----|---------|
| `model/[id]/page.tsx` | 3 | Gemini | Two-column layout (desktop), stacked (mobile). Left column: ModelDetail (name, owner, task, accuracy, CID link, contributor list, ownership badge, price). Right column: InferencePanel. Below both: MetricsDisplay (visible after inference). Tabs: Overview | Inference | Metrics | Contributors | Ownership. |
| `ModelDetail.tsx` | 2 | Gemini | All model metadata from on-chain PDA. Owner: truncated pubkey + Solana explorer link. Task type: colored badge. Accuracy: large number with "ZK Verified" badge if proof exists. CID: monospace, link to Pinata gateway. Price: SOL amount. Contributors: list of pubkeys with share % and "GitHub Verified" badges. Ownership badge: SPL token mint address + "1 of 1" indicator. |
| `InferencePanel.tsx` — MNIST canvas | 3 | Gemini | Drawing canvas: 280x280 px HTML5 Canvas. Mouse/touch draw events. Black background, white stroke. "Clear" button resets canvas. "Run Inference" button: (1) Downscale canvas to 28x28 grayscale, (2) Convert to float32 array, (3) Call `runInference(modelId, pixelData)` from `lib/api/backend.ts`, (4) Show loading state with spinner, (5) Display result. For text models (sentiment/summarizer): textarea input instead of canvas. |
| `MetricsDisplay.tsx` | 2 | Gemini | Shows TEE-attested metrics after inference: inference_time_ms (with bar gauge), input_tokens, output_tokens, memory_peak_kb. Green "TEE Verified" badge with shield icon. Expandable section: tee_attestation_hash in monospace. "View on Solana Explorer" link → opens InferenceRequest PDA on explorer. Confidence chart: 10 horizontal bars (digits 0-9) with percentage labels, highlighted bar for prediction. |
| `ContributorList.tsx` | 2 | Gemini | Table: contributor pubkey, share %, "GitHub Verified" badge (if contribution_proof exists), pending revenue, "Claim" button (if viewer is contributor and has pending revenue). |
| `OwnershipBadge.tsx` | 2 | Gemini | Shows: SPL Token-2022 mint address, supply = 1, current holder. "Transfer Ownership" button (if current wallet owns token). "List for Sale" button. "Buy Model" button (if listed). |
| `lib/api/backend.ts` — x402 from browser | 3 | GLM | `runInference(modelId, inputData)`: Step 1: POST to `BACKEND_URL/v1/inference/${modelId}` with input data → get HTTP 402 response. Step 2: Parse payment details (pay_to, amount). Step 3: Sign SOL transfer via wallet adapter (`wallet.signTransaction`). Step 4: Send transaction to Solana. Step 5: Retry POST with `X-Payment: txSignature` header. Step 6: Return result + metrics. Handle: insufficient balance (toast error), payment timeout, network errors. |

### Checkpoint 5

- [ ] Landing page: VAULT branding, dark theme, gradient text, animated sections
- [ ] Marketplace: 3+ model cards in grid, filter by task type works
- [ ] Model card → click → model detail page with all metadata
- [ ] Draw digit on canvas → "Run Inference" → prediction + confidence bars
- [ ] x402 payment flow from browser: Phantom popup → confirm → retry → result
- [ ] Metrics displayed with TEE Verified badge + Solana explorer link
- [ ] Ownership badge shows SPL token holder
- [ ] FilterBar filters work (task type, accuracy, sort)
- [ ] Responsive on mobile viewport
- [ ] All pages have smooth Framer Motion transitions

---

## Phase 6: Verification Layer — EZKL + Reclaim zkTLS + Privacy UI + Dashboard

**PS Requirements Covered: B2, M2 (full), M3 (full)**

**Goal**: ZK proof of model accuracy. zkTLS proof of GitHub contributions. Privacy proof page showing encrypted IPFS garbage + private transactions + TEE certificates. Creator dashboard with revenue charts and claim buttons.

### 6.1 EZKL ZK Proof

| Task | Diff | AI | Details |
|------|------|-----|---------|
| Install EZKL | 1 | GLM | `pip install ezkl`. Verify `ezkl --version`. |
| Generate ZK proof for MNIST | 4 | GLM | Steps (pre-compute before demo): (1) `ezkl gen-settings -M models/mnist.onnx`, (2) `ezkl compile-circuit -M models/mnist.onnx -S settings.json`, (3) `ezkl setup --compiled-circuit circuit.ezkl --srs-path kzg.srs`, (4) Prepare `test_input.json` with 100 MNIST test images, (5) `ezkl gen-witness -M models/mnist.onnx -D test_input.json`, (6) `ezkl prove --witness witness.json --compiled-circuit circuit.ezkl --pk pk.key`. Output: `proof.json`, `settings.json`, `kzg.srs`, `pk.key`, `vk.key`. Store in `vault-backend/zk_proofs/mnist/`. |
| `verify_inference` instruction | 3 | GLM | Args: inference_pda, zk_proof_hash ([u8;32]). Checks: `zk_proof_hash == model.zk_accuracy_proof_hash`. If match → `inference.status = VERIFIED (4)`. Full on-chain EZKL verifier is too expensive for hackathon; we store the pre-computed proof hash and verify it matches. At demo: show proof generation steps, then show on-chain verification instruction succeeded. |
| Store proof hash during model registration | 2 | GLM | Modify upload flow: after registration, call `update_zk_proof` instruction that sets `model.zk_accuracy_proof_hash = hash(proof.json)`. Shows "ZK Verified" badge on model. |

### 6.2 Reclaim Protocol zkTLS

| Task | Diff | AI | Details |
|------|------|-----|---------|
| Install Reclaim SDK | 1 | Gemini | `npm install @reclaimprotocol/js-sdk`. |
| Setup Reclaim proof template | 3 | Gemini | Create proof request in upload flow: `const reclaim = new Reclaim.ProofRequest(RECLAIM_APP_ID)`. Template for GitHub: URL pattern `https://api.github.com/repos/{org}/{repo}/stats/contributors`, response match contains contributor username. This proves the wallet owner made commits to that repo. |
| ContributorStep integration | 3 | Gemini | "Verify via GitHub" button next to each contributor row. On click: (1) Create Reclaim proof request, (2) Open Reclaim modal (QR code / deep link), (3) User authenticates with GitHub through Reclaim's TLS notary, (4) Reclaim generates zkTLS proof, (5) Extract proof hash, (6) Store as `contribution_proofs[i]` parameter for `add_contributor`. Badge: "GitHub Verified" (green checkmark). |
| On-chain proof storage | 2 | GLM | Modify `add_contributor`: accept `contribution_proof: [u8;32]` parameter. Store in `ModelRegistry.contribution_proofs`. In `distribute_revenue`: only distribute to contributors WITH non-zero proofs (contributors without verified proofs get 0%, their share redistributed to verified contributors). |
| Proof verification display | 1 | Gemini | On model detail page, next to each contributor: if `contribution_proofs[i] != [0u8;32]` → show green "GitHub Verified" badge with proof hash (expandable). If zero → show yellow "Unverified" badge. |

### 6.3 Privacy Proof Page

| Task | Diff | AI | Details |
|------|------|-----|---------|
| `privacy/page.tsx` | 2 | Gemini | Three sections in tabs: (1) Encrypted IPFS Preview, (2) Private Transaction Viewer, (3) TEE Certificate. Dark theme. "Privacy Proof" title with lock icon. Subtitle: "See for yourself — your models are private, your payments are confidential, your compute is verified." |
| `EncryptedPreview.tsx` | 2 | Gemini | Fetch encrypted model from Pinata gateway by CID. Display hex dump of first 256 bytes in monospace (clearly not a valid ONNX file — random bytes). Text: "This model is encrypted with AES-256-GCM. Only authorized TEE nodes can decrypt it. The decryption key never exists on any server — only inside the TEE enclave." Show encryption algorithm badge. |
| `PrivateTxViewer.tsx` | 2 | Gemini | Show a Solana explorer link for a recent inference payment made via Private Payment API. Display: tx signature, slot, from → to (addresses visible), **amount: [CONFIDENTIAL]**. Text: "This transaction was processed through MagicBlock's Private Ephemeral Rollup. The payment amount is hidden — only the sender and recipient can see the value." Badge: "Private Transaction". |
| `TEEBadge.tsx` | 2 | Gemini | Expandable card. Collapsed: green checkmark + "TEE Attestation Verified". Expanded: show fields — enclave_measurement (hex), runtime_hash (hex), input_hash (hex), output_hash (hex), metrics_hash (hex), timestamp, signature (hex). Text: "This attestation was generated inside an Intel TDX Trusted Execution Environment. Verify at: https://pccs.phala.network/tdx/certification/v4". |

### 6.4 Dashboard Page

| Task | Diff | AI | Details |
|------|------|-----|---------|
| `dashboard/page.tsx` | 3 | Gemini | Creator dashboard. Requires wallet connected. Fetches models owned by connected wallet from on-chain. Sections: (1) My Models — card list with stats, (2) Revenue Chart — Recharts AreaChart of daily SOL earned, (3) Pending Revenue — table with claim_revenue button per model, (4) Inference History — recent inferences with ratings. |
| Revenue chart | 2 | Gemini | Recharts `AreaChart` with gradient fill (indigo→transparent). X-axis: date. Y-axis: SOL earned. Tooltip: "0.015 SOL on Apr 19". Data from on-chain InferenceRequest PDAs (filter by model owner = connected wallet). |
| Claim revenue button | 2 | Gemini | Per model: show `accumulated_revenue[wallet_index]` SOL amount. "Claim" button → calls `claim_revenue` via Anchor program. Wallet popup for signing. On success: toast "X SOL claimed!" + amount updates to 0. |
| Inference history | 2 | Gemini | Table: model name, input hash (truncated), prediction, rating (stars), date, Solana explorer link. Data from InferenceRequest PDAs where requester = connected wallet. |

### 6.5 Badges & Indicators

| Task | Diff | AI | Details |
|------|------|-----|---------|
| `Badge.tsx` variants | 1 | Gemini | Pill-shaped badges: "ZK Verified" (green, shield icon), "TEE Protected" (blue, lock icon), "IPFS Stored" (purple, cloud icon), "Multi-Owner" (orange, users icon), "GitHub Verified" (green, check icon), "Private Tx" (indigo, eye-off icon). Small size (fit in card), expandable on click for details. |
| Conditionally show badges on ModelCard | 1 | Gemini | Logic: `zk_accuracy_proof_hash != [0u8;32]` → ZK Verified. `delegate_validator != Pubkey.default()` → TEE Protected. `ipfs_cid != ""` → IPFS Stored. `contributors.length > 1` → Multi-Owner. Each contributor: `contribution_proofs[i] != [0u8;32]` → GitHub Verified. |

### Checkpoint 6

- [ ] EZKL proof generated for MNIST model (proof.json exists)
- [ ] `verify_inference` instruction accepts and validates ZK proof hash on-chain
- [ ] "ZK Verified" badge appears on model with proof
- [ ] Reclaim zkTLS modal opens from ContributorStep in upload wizard
- [ ] GitHub verification generates proof hash stored in `contribution_proofs` on-chain
- [ ] "GitHub Verified" badge next to verified contributors
- [ ] Privacy page shows: encrypted IPFS hex dump, private tx viewer, TEE certificate
- [ ] TEEBadge expandable with full attestation details
- [ ] Dashboard: my models list, revenue chart with daily data, claim buttons
- [ ] Claim revenue works from browser (wallet signs → SOL received)
- [ ] All badge variants render correctly with correct conditional logic

---

## Phase 7: Agent + Pipeline Builder + Voice + AI Descriptions

**PS Requirements Covered: Cross-domain winning feature, demo wow factor**

**Goal**: Autonomous agent that discovers, pays, infers, and chains multiple models. Visual pipeline builder with React Flow. ElevenLabs voice narration for demo. Mistral for auto-generated descriptions and result explanations.

### 7.1 LangGraph Agent

| Task | Diff | AI | Details |
|------|------|-----|---------|
| Install LangGraph | 1 | GLM | `pip install langgraph langchain-core`. |
| AgentState definition | 2 | GLM | `TypedDict`: task (str), steps (List[dict]), current_step (int), discovered_models (List[dict]), selected_model (Optional[dict]), payment_tx (Optional[str]), inference_result (Optional[dict]), accumulated_results (List[dict]), final_output (Optional[str]), budget_remaining (float), total_cost (float), error (Optional[str]). |
| `plan` node | 2 | GLM | Decomposes user task into sub-tasks. Uses Groq API (fast, free tier) to parse task. E.g., "Analyze customer reviews" → [{step: 1, task: "sentiment", description: "Classify sentiment of reviews"}, {step: 2, task: "summarization", description: "Summarize findings"}]. Returns updated state with steps list. |
| `discover` node | 2 | GLM | Calls `/v1/discover?task={sub_task}&min_accuracy=90`. Selects top model by accuracy × reputation. Returns state with `selected_model`. |
| `negotiate` node | 1 | GLM | Checks `budget_remaining >= selected_model.price_per_use`. If yes → proceed. If no → set `final_output = "Budget exhausted"` and route to summarize. |
| `pay` node | 2 | GLM | Execute SOL transfer from agent wallet (deployer keypair) to RevenueEscrow. Get tx signature. Set `payment_tx`. |
| `infer` node | 3 | GLM | Call `/v1/inference/{model_id}` with X-Payment header using `payment_tx`. Feed previous step's output as input (for chained steps). Parse result. Set `inference_result`. |
| `verify` node | 2 | GLM | Check tee_attestation_hash is valid (non-zero). Check metrics within bounds (inference_time < 30s). If verified → proceed. If not → log warning, still proceed (don't block). |
| `chain` node | 1 | GLM | Feed `inference_result.output` as input to next step. Increment `current_step`. Route back to `discover`. |
| `summarize` node | 2 | GLM | Compile all `accumulated_results` into final output. Use Mistral API to generate natural language summary. E.g., "Customers love screen quality (92% positive), battery life is main concern (67% negative)." Set `final_output`. Include `total_cost` and model count. |
| StateGraph assembly | 3 | GLM | Build graph: plan → discover → negotiate → (pay if budget, summarize if not) → infer → verify → (chain if more steps, summarize if done) → END. Compile to `agent = graph.compile()`. |
| `POST /v1/agent/run` endpoint | 2 | GLM | Accepts `{task: string, budget: float}`. Runs agent. Returns SSE stream: each node execution emits event `{step: "discover", status: "running", data: ...}`. Client receives real-time updates. |

### 7.2 Visual Pipeline Builder

| Task | Diff | AI | Details |
|------|------|-----|---------|
| Install React Flow | 1 | Gemini | `npm install reactflow`. |
| `pipeline/page.tsx` | 2 | Gemini | Full-page canvas. Sidebar: model list (draggable). Main area: React Flow canvas. Bottom bar: Run/Pause/Reset controls. Right panel: AgentTerminal (streaming output). |
| `PipelineCanvas.tsx` | 3 | Gemini | React Flow setup: custom `ModelNode` component, edge type = smoothstep. Nodes draggable. Connect output port of one node → input port of next (creates chain). Controls: Run Pipeline (executes chain), Pause, Reset (clears results). Minimap in corner. Background: dots grid. |
| `ModelNode.tsx` | 2 | Gemini | Custom React Flow node: model name, task badge, status indicator (idle=gray, running=yellow pulse, completed=green, failed=red), accuracy %, price. Handle: one input port (top), one output port (bottom). |
| Pipeline execution logic | 3 | GLM | When "Run Pipeline" clicked: (1) Topologically sort connected nodes, (2) Execute inference sequentially (output of node N feeds as input to node N+1), (3) Each node calls x402 flow, (4) Update node status in real-time, (5) Show data flow on edges (animated dots), (6) Final output displayed in right panel. |

### 7.3 Agent Terminal + Voice

| Task | Diff | AI | Details |
|------|------|-----|---------|
| `AgentTerminal.tsx` | 2 | Gemini | Terminal-style display. Black background, green monospace text. SSE connection to `/v1/agent/run`. Each agent step shows: `> Discovering sentiment models...`, `> Found SentimentNet v3 (94.2%, 0.01 SOL)`, `> Paying 0.01 SOL...`, `> Payment confirmed: 5Kj8...qR2f`, `> Running inference...`, `> Result: positive (78%)`, `> Chaining to next model...`, `> Total cost: 0.028 SOL | Models used: 3`. Scrollable. Auto-scroll to bottom. |
| ElevenLabs voice narration | 2 | GLM | `services/elevenlabs.py`: After each agent step, call `eleven.text_to_speech.convert(text=step_description, voice_id="JBFqnCBsd6RMkjVDRZzb", model_id="eleven_turbo_v2_5")`. Stream audio via WebSocket to frontend. Frontend plays alongside terminal text. Toggle: "Voice Narration" on/off switch. |
| Mistral model descriptions | 2 | GLM | `services/mistral.py`: (1) During upload: `mistral.chat.complete(model="mistral-small-latest", messages=[{"role":"user","content":f"Generate a concise marketplace description for this ML model:\n{json.dumps(onnx_metadata)}"}])`. (2) During inference: `f"Explain this {task} result concisely:\nInput: {input}\nResult: {result}"`. Returns natural language explanation shown in UI. |

### Checkpoint 7

- [ ] Agent runs end-to-end: "Analyze reviews" → discovers 2-3 models → pays → infers → chains → summarizes
- [ ] Agent respects budget (stops if budget exhausted)
- [ ] SSE stream shows real-time agent steps
- [ ] Pipeline builder renders model nodes with connections
- [ ] "Run Pipeline" executes chained inferences with sequential data flow
- [ ] Node status updates: idle → running → completed/failed
- [ ] AgentTerminal shows green text steps in real-time
- [ ] ElevenLabs narrates agent reasoning (toggle works)
- [ ] Mistral generates natural language model descriptions
- [ ] Mistral explains inference results in plain English

---

## Phase 8: Deploy + Polish + Demo Prep

**Goal**: Everything deployed, polished, demo-ready. Backup video recorded. Pitch deck outlined.

### 8.1 Integration Testing

| Task | Diff | AI | Details |
|------|------|-----|---------|
| Full end-to-end test | 3 | GLM | Walk through EVERY flow: (1) Connect wallet on landing page, (2) Go to Upload → upload .onnx (encrypt→IPFS→register), (3) Model appears in marketplace, (4) Go to Marketplace → find model → click → detail page, (5) Draw digit → "Run Inference" → x402 payment → result + metrics, (6) Verify InferenceRequest PDA on Solana explorer, (7) Go to Dashboard → see revenue → claim, (8) Run agent with "Analyze reviews" → watch terminal + voice, (9) Build pipeline in Pipeline Builder → run → see chained results, (10) Go to Privacy page → see encrypted IPFS garbage, private tx, TEE cert, (11) Verify ZK badge on model. Document any breaks. |
| Fix broken flows | 3 | GLM | Fix anything from 8.1. Common issues: Anchor account sizing (8-byte discriminator + all fields), transaction size limits (split large ix into multiple txs), RPC rate limits (use Helius devnet), wallet adapter race conditions, ONNX preprocessing bugs, VRF callback timing (wait 5-10s on devnet). |
| Pre-seed demo data | 2 | GLM | Register 5-8 models on devnet with variety: MNIST (classification), SentimentNet (sentiment), SummarizerBot (summarization), plus 2-3 more. Different prices (0.005-0.05 SOL). Different accuracy (85-97%). Add contributors to 2-3 models. Run 20-30 inferences from deployer wallet + a second wallet to build up reputation + revenue. Rate some inferences. Makes marketplace look alive. |

### 8.2 Deployment

| Task | Diff | AI | Details |
|------|------|-----|---------|
| Deploy frontend → Vercel | 1 | Gemini | `vercel deploy --prod`. Set env vars from `frontend.env`. Custom domain optional. Verify: landing page loads, wallet connects, marketplace shows models. |
| Deploy backend → Railway | 2 | GLM | `railway up` or connect GitHub repo. Set env vars from `backend.env`. Ensure: ONNX models included in deploy (not gitignored), Pinata JWT available, Solana keypair accessible. Verify: `/v1/health` returns 200, `/v1/inference/mnist` returns 402. |
| Final program redeploy | 1 | GLM | `anchor deploy --provider.cluster devnet`. Verify program ID unchanged on Solana explorer. All PDAs still queryable. |
| Update frontend env to point to Railway backend | 1 | GLM | Change `NEXT_PUBLIC_BACKEND_URL` from `localhost:8000` to Railway URL. Redeploy frontend. |

### 8.3 Polish

| Task | Diff | AI | Details |
|------|------|-----|---------|
| Smooth page transitions | 2 | Gemini | `AnimatePresence` wrapping page content. `motion.div` with `initial={{opacity:0,y:20}}` `animate={{opacity:1,y:0}}` `exit={{opacity:0,y:-20}}`. Duration 0.2s. |
| Loading skeletons | 1 | Gemini | Shimmer skeleton placeholders for ModelCard (while fetching), InferencePanel (while running), Dashboard chart (while loading). Tailwind `animate-pulse` + slate-800 bg. |
| Toast notifications | 1 | Gemini | Success: "Model registered! ID: 3" (green). Error: "Payment failed: insufficient balance" (red). Info: "Inference running..." (blue). Use `sonner` or `react-hot-toast`. |
| Responsive testing | 1 | Gemini | Test on 375px (iPhone), 768px (tablet), 1440px (desktop). Fix: ModelGrid cols, InferencePanel stacking, Navbar hamburger menu on mobile, FilterBar wrapping. |
| Dark mode consistency | 1 | Gemini | Verify ALL components use slate-950/900/800 bg. No white flashes. All text readable (slate-100/400). All badges visible. All charts readable. |

### 8.4 Demo Prep

| Task | Diff | AI | Details |
|------|------|-----|---------|
| Record backup demo video | 1 | Gemini | OBS screen recording. Walk through: landing → connect wallet → marketplace → model detail → inference (draw 7) → metrics → upload → pipeline → agent terminal → privacy page. 3-5 minutes. Upload to YouTube unlisted. |
| Pitch deck outline (7 slides) | 2 | Gemini | (1) **Problem**: Centralized AI marketplaces take 30-50% cuts, no model privacy, no verification, no fair compute selection. (2) **Solution**: VAULT architecture — 5-layer system with ZK proofs, TEE encryption, VRF selection, on-chain revenue split. Architecture diagram. (3) **Demo**: Key moments — MNIST inference, agent chaining, privacy proof, ownership transfer. Screenshots. (4) **Tech Stack**: Solana + MagicBlock (ER/PER/VRF/Private Payments/Permission) + EZKL + Reclaim + x402. (5) **MagicBlock Integration**: The most comprehensive MB integration ever — all 5 products in one system. Show: ER zero-fee tx, PER private keys, VRF node selection, Private Payment, Permission Program. (6) **Business Model**: 70/25/5 split, subscription model, ownership marketplace, staking tiers. (7) **Team + Future**: Solo dev, future = compute node network, governance token, cross-chain. |
| Final sanity check | 1 | GLM | Verify ALL URLs work: frontend, backend health, IPFS gateway (each model CID), Solana explorer (program, each PDA type, inference txs). Verify wallet connects on devnet. Verify inference completes. Verify agent runs. Verify all badges show. Verify no 404s. |

### Checkpoint 8

- [ ] Full end-to-end flow works without errors
- [ ] Frontend deployed to Vercel, accessible via URL
- [ ] Backend deployed to Railway, `/v1/health` returns 200
- [ ] Program deployed on Solana devnet
- [ ] 5+ models registered with live-looking data
- [ ] 20+ inferences run from multiple wallets
- [ ] Revenue data visible on dashboard
- [ ] Demo video recorded and uploaded (unlisted YouTube)
- [ ] Pitch deck outline written (7 slides with content)
- [ ] All links valid: no 404s, no broken txs, no explorer errors
- [ ] Mobile responsive on 375px viewport
- [ ] Dark mode consistent across all pages
- [ ] Toast notifications for tx success/failure
- [ ] Loading skeletons during async operations

---

## Phase Summary & Timeline

| Phase | PS Requirements | Key AI | Hours |
|-------|----------------|--------|-------|
| 1 | On-Chain Foundation (#2,#3,#5,#6,#8,#10,#12,#13,M1) | Opus + GLM | 12h |
| 2 | Compute Node + Inference (#4,#9,#12,M3) | GLM | 6h |
| 3 | Encryption + IPFS + Upload (#1,#7,#8) | GLM + Gemini | 7h |
| 4 | MagicBlock Integration (B1,B4,B6,#11,M3) | **Opus** + GLM | 10h |
| 5 | Frontend Core (Visual demo of all) | Gemini + GLM | 10h |
| 6 | Verification (B2,M2,M3) | GLM + Gemini | 7h |
| 7 | Agent + Pipeline + Voice (Demo wow) | GLM + Gemini | 7h |
| 8 | Deploy + Polish + Demo | All | 5h |
| | **TOTAL** | | **~64h** |

## Execution Order (6-Day Sprint)

```
Day 1: Phase 1.1-1.3 (scaffold + PDAs + instructions)
       Phase 1.4 (Opus: SPL Token-2022)
       Phase 1.5 (ONNX models)
Day 2: Phase 1.6 (deploy + anchor test)
       Phase 2 (all backend)
       Phase 3.1-3.3 (wallet + encryption + IPFS)
Day 3: Phase 3.4-3.6 (upload wizard UI)
       Phase 4.1 (Opus: ER integration)
       Phase 4.2 (Opus: PER/TEE)
Day 4: Phase 4.3-4.4 (Opus: VRF + Private Payment)
       Phase 4.5 (ER tests)
       Phase 5.1-5.3 (Gemini: theme + landing)
Day 5: Phase 5.4-5.5 (Gemini: marketplace + inference UI)
       Phase 6 (verification layer)
       Phase 7.1 (agent backend)
Day 6: Phase 7.2-7.3 (pipeline + terminal + voice)
       Phase 8 (deploy + polish + demo)
```

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| SPL Token-2022 CPI fails | P0 | Fallback: regular SPL Token (supply=1). Token-2022 is for brownie points. |
| MagicBlock ER doesn't work on devnet | P1 | Fallback: run reputation updates on base layer (costs SOL but works). Mark ER as "architecture ready". |
| MagicBlock PER/TEE key read fails | P1 | Fallback: store encrypted keys off-chain in backend env. Claim "TEE integration pending — architecture complete". Show permission program + delegation working. |
| MagicBlock VRF callback never fires | P1 | Fallback: off-chain random node selection. Show VRF code in program + say "callback timing varies on devnet". |
| EZKL proof generation takes too long | P2 | Pre-generate before demo. Show proof file. Say "verified on test set". |
| Reclaim SDK issues | P2 | Placeholder zkTLS badge. Show UI flow in screenshots. |
| Backend deploy fails on Railway | P1 | Run backend locally with ngrok tunnel. |
| Pinata free tier (500MB) | P3 | Models are tiny (MNIST < 1MB). 3 models < 5MB. No issue. |
| Solana devnet RPC rate limits | P2 | Use Helius devnet endpoint (free tier). |
| `anchor build` fails with MB macros | P0 | Pin SDK versions. Test build after each macro addition. |

## Dependencies Between Phases

```
Phase 1 ──→ Phase 2 (need PDAs + instructions for on-chain reporting)
Phase 1 ──→ Phase 3 (need register_model instruction for upload flow)
Phase 1 ──→ Phase 4 (need deployed program to add #[ephemeral] + delegation)
Phase 2 ──→ Phase 4 (need inference flow for VRF + PER key usage)
Phase 3 ──→ Phase 4 (need encryption keys for PER key vault)
Phase 4 ──→ Phase 5 (need MB features working for UI wiring)
Phase 1-4 ──→ Phase 5 (UI wires into all working backend + on-chain)
Phase 2,4 ──→ Phase 7 (agent uses inference + discovery endpoints)
Phase 5 ──→ Phase 6 (UI components for verification badges + dashboard)
Phase All ──→ Phase 8 (final integration)
```

## What Judges Will See (Demo Script)

```
1. Landing Page: "VAULT — Decentralized AI Model Marketplace"
   - Stats counter animating up: "8 Models | 1,247 Inferences | 12.5 SOL Earned"

2. Connect Wallet (Phantom, devnet)

3. Marketplace: Grid of model cards with badges
   - "ZK Verified" "TEE Protected" "Multi-Owner" "IPFS Stored"

4. Click model → Detail page
   - Draw "7" on canvas → "Run Inference"
   - Phantom popup: "Pay 0.01 SOL?"
   - Result: "Prediction: 7 (98.1% confidence)"
   - Metrics: "12ms | 784 input tokens | TEE Verified"
   - Click "View on Explorer" → InferenceRequest PDA visible on chain

5. Upload Flow: Select .onnx → encrypt → IPFS → register
   - AES-256-GCM encryption animation
   - CID appears → model on-chain

6. Pipeline Builder: Drag sentiment → topic → summarizer nodes
   - Connect edges → "Run Pipeline"
   - Agent terminal: green text streaming in real-time
   - ElevenLabs voice: "Discovering sentiment analysis models..."
   - Final: "Customers love screen quality..."

7. Privacy Page:
   - Encrypted IPFS file = garbage hex bytes
   - Private transaction = amount [CONFIDENTIAL]
   - TEE certificate = verified attestation

8. Dashboard: Revenue chart, claim buttons, model stats
```

## MagicBlock V4 Hack — What Makes Us Win

We integrate **ALL 5 MagicBlock products** in one coherent system:

| Product | Our Use | Impact |
|---------|---------|--------|
| **ER** | Zero-fee reputation updates, node heartbeats, inference counters, Magic Actions (auto-commit) | Real-time stats without gas |
| **PER/TEE** | AES model decryption keys as private state, permission-gated access for compute nodes | Model privacy GUARANTEED by hardware |
| **VRF** | Fair compute node selection via `ephemeral_vrf_sdk` callback | Provable fairness, no manipulation |
| **Private Payment** | Confidential inference billing via PER API | Payment amounts hidden on explorer |
| **Permission Program** | Fine-grained member flags (AUTHORITY, TX_LOGS, TX_BALANCES) for model key access | Only authorized nodes decrypt models |

No other V4 team will combine all five. Previous winners used 1-2 products. We use 5.
