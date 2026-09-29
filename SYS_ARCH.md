# VAULT — Verifiable Autonomous Unified Layer for Transformers

## Complete System Architecture Document

---

## 1. THE PROBLEM STATEMENT

> **Develop a decentralized platform that enables AI developers to securely publish, share and monetize their machine learning models, while allowing users to access these models in a trustless, transparent, and permission-controlled manner without relying on centralized intermediaries.**

### PS Requirements Checklist

| # | PS Requirement | Our Implementation | Priority |
|---|---|---|---|
| 1 | Models encrypted before storage | AES-256-GCM encryption in browser before IPFS upload | P0 |
| 2 | Ownership linked to blockchain wallet | SPL Token-2022 (supply=1) per model. Token holder = owner | P0 |
| 3 | Immutable metadata stored on-chain | Model PDA on Solana: hash, owner, accuracy, price, contributors | P0 |
| 4 | Pay-per-use API access | x402 HTTP 402 flow -> Solana payment -> inference -> result | P0 |
| 5 | Subscription-based models | Subscription PDA with expiry timestamp, checked on inference | P0 |
| 6 | Transparent revenue sharing via smart contracts | Multi-contributor split with zkTLS-verified GitHub shares | P0 |
| 7 | Models stored on IPFS | Encrypted -> Pinata IPFS. CID stored on-chain | P0 |
| 8 | Blockchain stores only metadata | Model PDA stores: CID, price, owner, accuracy — NOT model data | P0 |
| 9 | Nodes perform model inference | FastAPI compute nodes load ONNX, run onnxruntime, return result | P0 |
| 10 | Incentivized using tokens | Compute nodes earn per-inference fees (25% of inference price) | P1 |
| 11 | Distributed load balancing | VRF-based node selection from registered compute pool | P1 |
| 12 | All transactions recorded on blockchain | Every inference creates InferenceRequest PDA on Solana | P0 |
| 13 | No intermediaries or hidden fees | Direct wallet-to-wallet via smart contract. Split is on-chain | P0 |
| B | Fully decentralized inference | VRF node selection + TEE attestation | P1 |
| B | ZK model verification / proof of correctness | EZKL ZK proof of model accuracy on test set | P2 |
| B | Tokenomics design | Design doc + bonding curve diagram | P2 |
| B | On-chain reputation | Reputation PDA on ER, commits to base layer periodically | P1 |
| B | Multiple AI frameworks | ONNX as universal format (PyTorch, TF, sklearn all export to ONNX) | P1 |
| B | Gas optimization / L2 | MagicBlock Ephemeral Rollups = zero-fee L2 for real-time ops | P0 |
| M | Full ownership transfer | SPL token transfer = ownership transfer | P0 |
| M | Multi-owner equal split | zkTLS GitHub verification -> on-chain contribution shares -> auto-split | P0 |
| M | Token usage transparency | TEE-attested inference metrics stored on-chain | P1 |

B = Brownie Point | M = Mentor Suggestion

---

## 2. SYSTEM ARCHITECTURE — 5 LAYERS

```
+----------------------------------------------------------------------+
|                      LAYER 5: AGENTIC LAYER                          |
|  LangGraph StateGraph: discover -> negotiate -> pay -> infer -> verify|
|  x402 Protocol: HTTP 402 machine-to-machine payments                |
|  ElevenLabs: Voice narration of agent reasoning (during demo)       |
|  Visual Pipeline Builder: Drag-and-drop model chaining UI           |
+----------------------------------------------------------------------+
|                    LAYER 4: VERIFICATION LAYER                       |
|  EZKL: ZK proof of model accuracy (pre-generated, verified on-chain)|
|  Reclaim Protocol: zkTLS proof of GitHub/HuggingFace contribution  |
|  TEE Attestation: MagicBlock verifyTeeRpcIntegrity() for compute    |
|  Inference Metrics: TEE-attested timing/token/FLOP measurements    |
+----------------------------------------------------------------------+
|                  LAYER 3: CONFIDENTIAL COMPUTE LAYER                 |
|  MagicBlock PER/TEE: Model AES keys stored as private state         |
|  Permission Program: Only authorized nodes can read decryption key   |
|  Compute Nodes: FastAPI + ONNX Runtime inside TEE enclave           |
|  InferONNX Pattern: Model partitioning for TEE memory constraints  |
+----------------------------------------------------------------------+
|                     LAYER 2: MARKET LAYER                            |
|  MagicBlock ER: Real-time usage stats, pricing, reputation (0-fee)  |
|  ORAO VRF: Provably fair compute node selection via CPI             |
|  Private Payment API: Confidential billing via MagicBlock PER       |
|  Revenue Split: Auto-distribute by zkTLS-verified contribution %    |
|  Ownership: SPL Token-2022 (supply=1) per model, transferable      |
|  Subscription Engine: Time-gated access with on-chain expiry        |
+----------------------------------------------------------------------+
|                     LAYER 1: ON-CHAIN REGISTRY                       |
|  Solana Base Layer (Devnet)                                         |
|  Anchor Program: vault_program (all PDAs below)                     |
|  ModelRegistry PDA | InferenceRequest PDA | ComputeNode PDA        |
|  RevenueEscrow PDA | Subscription PDA | Reputation PDA             |
|  Encrypted Models on IPFS (Pinata) — only CID hash stored on-chain |
|  SPL Token-2022 for ownership tokens                                |
+----------------------------------------------------------------------+
```

---

## 3. SMART CONTRACT ARCHITECTURE (Anchor / Solana)

### 3.1 Program Structure

```
programs/vault/
+-- Cargo.toml
+-- src/
    +-- lib.rs                          // Program entry point with #[ephemeral]
    +-- constants.rs                    // Seeds, sizes, fee basis points
    +-- errors.rs                       // Custom error codes
    +-- state/
    |   +-- mod.rs
    |   +-- model.rs                    // ModelRegistry account
    |   +-- inference_request.rs        // InferenceRequest account
    |   +-- compute_node.rs             // ComputeNode account
    |   +-- subscription.rs            // Subscription account
    |   +-- reputation.rs              // Reputation account (ER-updated)
    +-- instructions/
        +-- mod.rs
        +-- register_model.rs           // Creator registers model + mints ownership token
        +-- add_contributor.rs          // Add contributor with verified share
        +-- update_model.rs             // Update price, description, deactivate
        +-- list_for_sale.rs            // List model for full ownership transfer
        +-- buy_model.rs                // Buy full ownership (SPL token transfer)
        +-- transfer_ownership.rs       // Direct ownership transfer
        +-- request_inference.rs        // User requests inference (creates request PDA)
        +-- assign_node_vrf.rs          // VRF selects compute node
        +-- complete_inference.rs       // Node fills output + metrics
        +-- verify_inference.rs         // Anyone verifies ZK proof on-chain
        +-- create_subscription.rs      // User subscribes to a model
        +-- check_subscription.rs       // Verify active subscription
        +-- register_node.rs            // Compute node registration + stake
        +-- deregister_node.rs          // Node leaves, unstakes
        +-- distribute_revenue.rs       // Auto-split by contribution shares
        +-- claim_revenue.rs            // Contributor claims accumulated SOL
        +-- delegate_model_tee.rs       // Delegate Model PDA to MagicBlock TEE
        +-- update_reputation_er.rs     // ER update (zero-fee, real-time)
        +-- commit_reputation.rs        // Commit ER state to base layer
+-- tests/
    +-- vault.ts                        // Anchor test suite (TypeScript)
```

### 3.2 Account Structures (PDAs)

#### ModelRegistry PDA

```
Seeds: [b"model", model_id.to_le_bytes()]
Size: ~512 bytes

Fields:
+-- bump: u8
+-- model_id: u64                      // Auto-incrementing model ID
+-- owner: Pubkey                      // Current owner wallet (derived from token holder)
+-- ownership_token_mint: Pubkey       // SPL Token-2022 mint (supply=1)
+-- ipfs_cid: String (64 chars max)    // IPFS CID of encrypted model file
+-- encryption_key_hash: [u8; 32]      // SHA-256 hash of AES key (actual key in TEE)
+-- model_format: u8                   // 0=ONNX, 1=PyTorch, 2=TensorFlow, 3=sklearn
+-- task_type: u8                      // 0=classification, 1=sentiment, 2=summarization, 3=object_detection
+-- framework_version: String (16)     // e.g. "onnx-1.14"
+-- accuracy_claim: u16                // Basis points (9420 = 94.20%)
+-- zk_accuracy_proof_hash: [u8; 32]   // EZKL proof hash (verified on-chain)
+-- price_per_use: u64                 // Lamports per single inference
+-- subscription_price: u64            // Lamports for 30-day unlimited access
+-- is_listed_for_sale: bool           // Whether model is listed for full ownership sale
+-- sale_price: u64                    // Price for complete ownership transfer
+-- contributors: Vec<Pubkey>          // Up to 10 contributor wallets
+-- contribution_shares: Vec<u16>      // Basis points per contributor (sum = 10000)
+-- contribution_proofs: Vec<[u8;32]>  // zkTLS proof hashes for each contributor
+-- accumulated_revenue: Vec<u64>      // Unclaimed revenue per contributor
+-- total_revenue: u64                 // Lifetime revenue earned
+-- inference_count: u64               // Total inferences (ER-updated, committed periodically)
+-- reputation_score: u32              // 0-10000 basis points (ER-updated)
+-- total_ratings: u32                 // Number of ratings received
+-- sum_ratings: u32                   // Sum of all ratings (average = sum/total)
+-- is_active: bool                    // Creator can deactivate
+-- created_at: i64                    // Clock::get().unix_timestamp
+-- updated_at: i64                    // Last update timestamp
+-- delegate_validator: Pubkey         // TEE validator this PDA is delegated to
```

#### InferenceRequest PDA

```
Seeds: [b"inference", requester.key(), request_nonce.to_le_bytes()]
Size: ~384 bytes

Fields:
+-- bump: u8
+-- requester: Pubkey                  // User who requested inference
+-- model: Pubkey                      // ModelRegistry PDA address
+-- assigned_node: Pubkey              // VRF-selected compute node (filled after VRF)
+-- input_hash: [u8; 32]              // SHA-256 of input data
+-- output_hash: [u8; 32]             // SHA-256 of output (filled after inference)
+-- zk_inference_proof: [u8; 32]      // ZK proof that output = model(input) (optional)
+-- payment_amount: u64               // Amount paid in lamports
+-- payment_signature: String (88)    // Solana tx signature of payment
+-- status: u8                        // 0=created, 1=paid, 2=node_assigned, 3=completed, 4=verified, 5=disputed
+-- inference_time_ms: u32            // TEE-attested inference duration
+-- input_tokens: u32                 // TEE-attested input token count
+-- output_tokens: u32                // TEE-attested output token count
+-- compute_flops: u64                // TEE-attested compute usage
+-- memory_peak_kb: u32               // TEE-attested peak memory
+-- tee_attestation_hash: [u8; 32]    // TEE attestation covering all metrics
+-- rating: u8                        // User rating 0-5 (0 = not rated)
+-- created_at: i64
+-- completed_at: i64
```

#### ComputeNode PDA

```
Seeds: [b"node", node_address.key()]
Size: ~256 bytes

Fields:
+-- bump: u8
+-- node_address: Pubkey               // Node operator's wallet
+-- endpoint_url: String (128)         // FastAPI URL (e.g., "https://node1.vault.ai")
+-- stake: u64                         // Staked lamports (Sybil resistance)
+-- inference_count: u64               // Total inferences completed
+-- total_inference_time_ms: u64       // Cumulative inference time
+-- uptime_score: u32                  // 0-10000 basis points
+-- reputation: u32                    // 0-10000 basis points
+-- tee_attestation_hash: [u8; 32]    // Latest TEE attestation cert hash
+-- supported_task_types: u16          // Bitmask of supported task types
+-- max_model_size_kb: u32             // Maximum model size this node can handle
+-- is_active: bool
+-- registered_at: i64
+-- last_heartbeat: i64                // ER-updated, last activity timestamp
```

#### Subscription PDA

```
Seeds: [b"subscription", subscriber.key(), model.key()]
Size: ~128 bytes

Fields:
+-- bump: u8
+-- subscriber: Pubkey                 // Subscriber wallet
+-- model: Pubkey                      // ModelRegistry PDA address
+-- start_time: i64                    // Subscription start timestamp
+-- expiry_time: i64                   // Subscription end timestamp
+-- amount_paid: u64                   // Total amount paid
+-- inference_count: u64               // Inferences used during subscription
+-- is_active: bool                    // Active = current_time < expiry_time
```

### 3.3 Instruction Flow Diagrams

#### A. Model Registration Flow

```
Creator -> register_model()
    |
    +-- 1. Validate inputs (CID format, price > 0, task_type valid)
    +-- 2. Create ModelRegistry PDA (rent-exempt, ~5000 lamports)
    +-- 3. Mint SPL Token-2022 (supply=1) -> ownership_token_mint
    +-- 4. Create ATA (Associated Token Account) for creator
    +-- 5. Mint 1 token to creator's ATA
    +-- 6. Set mint authority to None (no more tokens can ever be minted)
    +-- 7. Set model fields (CID, price, task_type, accuracy_claim)
    +-- 8. If contributors provided:
    |      +-- Verify zkTLS proofs for each contributor
    |      +-- Set contribution_shares (must sum to 10000)
    |      +-- Initialize accumulated_revenue = [0, 0, ...]
    +-- 9. Emit ModelRegistered event with model_id, owner, CID
```

#### B. Inference Flow (The Money Shot)

```
User -> request_inference(model_id, input_hash)
    |
    +-- 1. Check model is_active
    +-- 2. Check user has valid subscription OR sufficient payment
    +-- 3. If pay-per-use: transfer price_per_use lamports to program's revenue PDA
    +-- 4. Create InferenceRequest PDA (status = PAID)
    |
    +-- 5. assign_node_vrf() -- ORAO VRF CPI
    |      +-- Request randomness from ORAO VRF program
    |      +-- Callback fills assigned_node field from registered node pool
    |      +-- Status -> NODE_ASSIGNED
    |
    +-- 6. Off-chain: Selected compute node receives request via WebSocket
    |      +-- Node calls MagicBlock TEE endpoint to get decryption key
    |      +-- Node downloads encrypted model from IPFS
    |      +-- Node decrypts model in memory (AES-256-GCM)
    |      +-- Node runs ONNX inference
    |      +-- Node measures metrics (time, tokens, FLOPs, memory) inside TEE
    |      +-- Node generates TEE attestation covering output + metrics
    |      +-- Node returns result to user + calls complete_inference()
    |
    +-- 7. complete_inference(output_hash, metrics, tee_attestation)
    |      +-- Verify TEE attestation signature
    |      +-- Store output_hash, all metrics, attestation
    |      +-- Status -> COMPLETED
    |      +-- update_reputation_er() on ER (zero-fee, real-time)
    |
    +-- 8. distribute_revenue()
    |      +-- Calculate shares: model.contribution_shares
    |      +-- Creator share (if solo): 70% to creator, 25% to node, 5% to protocol
    |      +-- Multi-contributor: 70% split by shares, 25% to node, 5% to protocol
    |      +-- Add to accumulated_revenue for each contributor
    |
    +-- 9. User optionally calls rate_inference(rating: u8)
           +-- Updates model.total_ratings, model.sum_ratings
```

#### C. Ownership Transfer Flow

```
Scenario 1: Direct Transfer
    Owner A calls transfer_ownership(new_owner)
    +-- SPL token transfered from Owner A's ATA to Owner B's ATA
    +-- Model PDA's owner field updated
    +-- Emit OwnershipTransferred event

Scenario 2: Listed Sale
    Owner calls list_for_sale(price: u64)
    +-- model.is_listed_for_sale = true
    +-- model.sale_price = price
    +-- Model appears in marketplace "For Sale" section

    Buyer calls buy_model(model_id)
    +-- Verify model.is_listed_for_sale == true
    +-- Transfer model.sale_price lamports from buyer to owner
    +-- SPL token transferred from owner's ATA to buyer's ATA
    +-- model.owner = buyer
    +-- model.is_listed_for_sale = false
    +-- All future revenue goes to new owner (resets contributor shares)
    +-- Emit ModelSold event
```

### 3.4 MagicBlock Integration (Critical for V4 Hack)

```
EPHEMERAL ROLLUP (ER) -- Zero-fee, real-time state:
+-- update_reputation_er()      -> Reputation score updates after each inference
+-- update_node_heartbeat()     -> Node uptime tracking
+-- update_usage_stats()        -> Real-time model usage counter

COMMIT (ER -> Base Layer):
+-- commit_reputation()         -> Periodic commit of ER reputation to Solana
+-- commit_usage_stats()        -> Periodic commit of usage counters

PRIVATE ER (PER/TEE) -- Confidential state:
+-- AES decryption keys stored as private PER state
+-- Only TEE validator can read keys
+-- Permission Program controls who can request key access
+-- Keys released ONLY after verified payment

VRF -- Verifiable Randomness:
+-- ORAO VRF CPI for node selection
+-- RequestV2 instruction with model_id as seed
+-- Callback assigns node from active pool

DELEGATE macro usage:
+-- Model PDA delegated to TEE validator for key management
+-- Reputation PDA delegated to ER validator for real-time updates
+-- ComputeNode PDA delegated to ER for heartbeat tracking
```

---

## 4. BACKEND ARCHITECTURE (FastAPI Compute Node)

### 4.1 Structure

```
backend/
+-- main.py                         // FastAPI app entry point
+-- config.py                       // Environment config (RPC URL, keypair path, Pinata JWT)
+-- requirements.txt                // onnxruntime, fastapi, uvicorn, solders, httpx, cryptography
+-- models/                         // Pre-loaded ONNX models
|   +-- mnist.onnx                  // Digit classifier (28x28 grayscale -> 0-9)
|   +-- sentiment.onnx              // Text -> positive/negative
|   +-- summarizer.onnx             // Text -> extractive summary
+-- routers/
|   +-- inference.py                // /v1/inference/{model_id} -- the core endpoint
|   +-- models.py                   // /v1/models -- list available models
|   +-- discover.py                 // /v1/discover -- agent model discovery
|   +-- health.py                   // /v1/health -- node health check
+-- middleware/
|   +-- x402.py                     // HTTP 402 payment verification middleware
|   +-- tee_attestation.py          // TEE attestation generation
+-- services/
|   +-- onnx_runner.py              // Load ONNX, run inference, measure metrics
|   +-- ipfs_client.py              // Pinata download + AES decrypt
|   +-- solana_verifier.py          // Verify Solana tx signatures
|   +-- encryption.py               // AES-256-GCM encrypt/decrypt
|   +-- metrics.py                  // Inference metrics measurement
+-- ws/
    +-- realtime.py                 // WebSocket for agent terminal + pipeline updates
```

### 4.2 Core Inference Endpoint

```
POST /v1/inference/{model_id}

Flow:
1. Client sends request without payment header
2. Server responds HTTP 402 with payment details
3. Client pays via Solana, gets tx signature
4. Client retries with X-Payment header
5. Server verifies payment on Solana RPC
6. Server runs inference
7. Server returns result + metrics + attestation
```

```python
@app.post("/v1/inference/{model_id}")
async def inference(model_id: str, request: InferenceInput):
    payment_sig = request.headers.get("X-Payment")
    if not payment_sig:
        model = await get_model_metadata(model_id)
        return JSONResponse(
            status_code=402,
            content={
                "status": "payment_required",
                "pay_to": model.revenue_pda,
                "amount": model.price_per_use / 1e9,
                "currency": "SOL",
                "network": "devnet",
                "model_id": model_id,
                "model_name": model.name,
                "accuracy": model.accuracy_claim / 100,
            }
        )

    verified = await verify_solana_payment(payment_sig, expected_amount, expected_recipient)
    if not verified:
        raise HTTPException(403, "Payment not verified")

    session = await load_onnx_model(model_id)

    start_time = time.perf_counter_ns()
    start_memory = psutil.Process().memory_info().rss
    result = session.run(None, preprocess(request.input_data))
    end_time = time.perf_counter_ns()
    end_memory = psutil.Process().memory_info().rss

    metrics = {
        "inference_time_ms": (end_time - start_time) / 1e6,
        "input_tokens": count_tokens(request.input_data),
        "output_tokens": count_tokens(result),
        "memory_peak_kb": max(start_memory, end_memory) // 1024,
    }

    attestation = await generate_tee_attestation(model_id, result, metrics)
    await report_metrics_onchain(model_id, payment_sig, metrics, attestation)

    return {
        "result": postprocess(result),
        "metrics": metrics,
        "tee_attestation": attestation,
        "model_id": model_id,
        "payment_verified": True,
        "on_chain_tx": payment_sig,
    }
```

### 4.3 Model Discovery Endpoint (For Agent)

```python
@app.get("/v1/discover")
async def discover(task: str, min_accuracy: float = 0, sort_by: str = "accuracy"):
    models = await query_models_by_task(task)
    filtered = [m for m in models if m.accuracy_claim / 100 >= min_accuracy]
    sorted_models = sorted(filtered, key=lambda m: getattr(m, sort_by), reverse=True)

    return {
        "models": [
            {
                "id": m.model_id,
                "name": m.name,
                "task": task,
                "accuracy": m.accuracy_claim / 100,
                "price_sol": m.price_per_use / 1e9,
                "inference_count": m.inference_count,
                "reputation": m.reputation_score / 100,
                "zk_verified": m.zk_accuracy_proof_hash != bytes(32),
                "tee_protected": m.delegate_validator != Pubkey.default(),
                "contributors": len(m.contributors),
            }
            for m in sorted_models
        ]
    }
```

### 4.4 ElevenLabs Integration (Demo Enhancement)

```python
from elevenlabs import ElevenLabs

eleven = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

async def narrate_agent_step(step_description: str):
    audio = eleven.text_to_speech.convert(
        text=step_description,
        voice_id="JBFqnCBsd6RMkjVDRZzb",
        model_id="eleven_turbo_v2_5",
    )
    await websocket.send_bytes(audio)

# Usage in agent pipeline:
await narrate_agent_step("Discovering sentiment analysis models on VAULT marketplace...")
models = agent.discover("sentiment", min_accuracy=90)
await narrate_agent_step(f"Found {len(models)} models. Selecting the best one with 94.2% accuracy...")
```

### 4.5 Mistral Integration (AI-Powered Model Descriptions)

```python
from mistralai import Mistral

mistral = Mistral(api_key=os.getenv("MISTRAL_API_KEY"))

async def generate_model_description(onnx_metadata: dict) -> str:
    response = await mistral.chat.complete_async(
        model="mistral-small-latest",
        messages=[{
            "role": "user",
            "content": f"Generate a concise marketplace description for this ML model:\n{json.dumps(onnx_metadata)}"
        }]
    )
    return response.choices[0].message.content

async def explain_inference_result(model_task: str, input_data: str, result: dict) -> str:
    response = await mistral.chat.complete_async(
        model="mistral-small-latest",
        messages=[{
            "role": "user",
            "content": f"Explain this {model_task} result concisely:\nInput: {input_data}\nResult: {json.dumps(result)}"
        }]
    )
    return response.choices[0].message.content
```

---

## 5. FRONTEND ARCHITECTURE (Next.js 15 + Tailwind)

### 5.1 Structure (Using CogniStream Theme)

```
frontend/
+-- package.json
+-- next.config.ts
+-- tailwind.config.ts
+-- src/
    +-- app/
    |   +-- layout.tsx              // Root layout with WalletProvider + fonts
    |   +-- page.tsx                // Landing/Hero page
    |   +-- marketplace/
    |   |   +-- page.tsx            // Model grid with filters + search
    |   +-- model/[id]/
    |   |   +-- page.tsx            // Single model detail + run inference + metrics
    |   +-- upload/
    |   |   +-- page.tsx            // Model upload flow (encrypt -> IPFS -> register)
    |   +-- pipeline/
    |   |   +-- page.tsx            // Visual pipeline builder (React Flow)
    |   +-- dashboard/
    |   |   +-- page.tsx            // Creator dashboard (revenue, models, analytics)
    |   +-- privacy/
    |       +-- page.tsx            // Privacy proof page
    +-- components/
    |   +-- layout/
    |   |   +-- Navbar.tsx
    |   |   +-- Footer.tsx
    |   +-- marketplace/
    |   |   +-- ModelCard.tsx       // Individual model card with stats + badges
    |   |   +-- ModelGrid.tsx       // Grid layout with filters
    |   |   +-- FilterBar.tsx       // Task type, accuracy, price, reputation filters
    |   +-- model/
    |   |   +-- ModelDetail.tsx     // Full model info with all verification badges
    |   |   +-- InferencePanel.tsx  // Run inference UI (MNIST canvas / text input)
    |   |   +-- MetricsDisplay.tsx  // TEE-attested metrics visualization
    |   |   +-- ContributorList.tsx // Multi-owner list with verified shares
    |   |   +-- OwnershipBadge.tsx  // SPL token ownership indicator
    |   +-- upload/
    |   |   +-- UploadWizard.tsx    // Step-by-step upload flow
    |   |   +-- EncryptionStep.tsx  // AES encryption animation
    |   |   +-- IPFSStep.tsx        // Upload to Pinata + show CID
    |   |   +-- ContributorStep.tsx // Add contributors + zkTLS verification
    |   |   +-- RegisterStep.tsx    // On-chain registration + delegation
    |   +-- pipeline/
    |   |   +-- PipelineCanvas.tsx  // React Flow canvas for model chaining
    |   |   +-- ModelNode.tsx       // Draggable model node
    |   |   +-- PipelineControls.tsx// Run/pause/reset pipeline
    |   |   +-- AgentTerminal.tsx   // Real-time agent reasoning display
    |   +-- wallet/
    |   |   +-- WalletConnect.tsx   // Phantom wallet button
    |   +-- privacy/
    |   |   +-- EncryptedPreview.tsx// Download encrypted IPFS file (garbage)
    |   |   +-- PrivateTxViewer.tsx // Show Solana Explorer with private tx
    |   |   +-- TEEBadge.tsx        // TEE attestation certificate display
    |   +-- shared/
    |       +-- Badge.tsx           // ZK Verified, TEE Protected, etc.
    |       +-- AnimatedFlow.tsx    // Step-by-step pipeline animation
    |       +-- StatsCounter.tsx    // Real-time counter via ER WebSocket
    +-- lib/
        +-- solana/
        |   +-- wallet-adapter.ts   // Phantom wallet setup
        |   +-- program.ts          // Anchor program client
        |   +-- transactions.ts     // Helper functions for all instructions
        +-- ipfs/
        |   +-- pinata.ts           // Pinata upload/download
        |   +-- encrypt.ts          // AES-256-GCM (Web Crypto API in browser)
        +-- reclaim/
        |   +-- zktls.ts            // Reclaim Protocol zkTLS verification
        +-- api/
            +-- backend.ts          // FastAPI client (inference, discover, health)
```

### 5.2 Key UI Components Behavior

#### Model Card (Marketplace Grid)

```
+----------------------------------+
|  SentimentNet v3                 |
|  ------------------------------ |
|  Task: Sentiment Analysis       |
|  Accuracy: 94.2%                |
|                                 |
|  [ZK Verified] [TEE Protected]  |
|  [3 Contributors] [IPFS]       |
|                                 |
|  0.01 SOL/inference             |
|  12,483 inferences              |
|  4.8/5 (892 ratings)           |
|                                 |
|  [ Run Inference ] [ Buy Model ]|
+----------------------------------+
```

#### Inference Panel (MNIST Example)

```
+----------------------------------------------+
|  Draw a digit:                               |
|  +------------------+    Result:             |
|  |                  |    +----------------+  |
|  |    (Canvas)      |    |  Prediction: 7 |  |
|  |    User draws    |    |  Confidence:   |  |
|  |    a digit       |    |  98.1%         |  |
|  |                  |    +----------------+  |
|  +------------------+                         |
|                                               |
|  Verified Metrics (TEE-Attested):            |
|  +-- Inference Time: 12ms                    |
|  +-- Input Tokens: 784 (28x28 pixels)        |
|  +-- Memory: 4.2 MB                          |
|  +-- TEE Attestation: Verified               |
|                                               |
|  On-Chain Proof:                             |
|  +-- Payment TX: 5Kj8...qR2f                |
|  +-- VRF Node: Node #3 (Mumbai)             |
|  +-- Solana Explorer ->                      |
+----------------------------------------------+
```

---

## 6. AGENT ARCHITECTURE (LangGraph)

### 6.1 StateGraph Design

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, List, Optional

class AgentState(TypedDict):
    task: str
    steps: List[dict]
    current_step: int
    discovered_models: List[dict]
    selected_model: Optional[dict]
    payment_tx: Optional[str]
    inference_result: Optional[dict]
    accumulated_results: List[dict]
    final_output: Optional[str]
    budget_remaining: float
    error: Optional[str]

graph = StateGraph(AgentState)

graph.add_node("plan", plan_task)
graph.add_node("discover", discover_model)
graph.add_node("negotiate", check_price)
graph.add_node("pay", execute_payment)
graph.add_node("infer", run_inference)
graph.add_node("verify", verify_result)
graph.add_node("chain", prepare_next)
graph.add_node("summarize", final_output)

graph.set_entry_point("plan")
graph.add_edge("plan", "discover")
graph.add_edge("discover", "negotiate")
graph.add_conditional_edges("negotiate",
    lambda s: "pay" if s["budget_remaining"] >= s["selected_model"]["price"] else "summarize")
graph.add_edge("pay", "infer")
graph.add_edge("infer", "verify")
graph.add_conditional_edges("verify",
    lambda s: "chain" if s["current_step"] < len(s["steps"]) - 1 else "summarize")
graph.add_edge("chain", "discover")
graph.add_edge("summarize", END)

agent = graph.compile()
```

### 6.2 Agent Demo Flow

```
User Input: "Analyze customer reviews for our product and give me actionable insights"

Agent Execution:
+-------------------------------------------------------------+
| STEP 1: PLAN                                                |
| "I need to: 1) Classify sentiment, 2) Extract topics,       |
|  3) Summarize findings"                                     |
+-------------------------------------------------------------+
| STEP 2: DISCOVER (sentiment)                                |
| GET /v1/discover?task=sentiment&min_accuracy=90              |
| Found: SentimentNet v3 (94.2%, 0.01 SOL, 4.8 stars)        |
+-------------------------------------------------------------+
| STEP 3: PAY (x402 flow)                                    |
| POST /v1/inference/sentiment-v3                             |
| -> HTTP 402 { pay_to: "...", amount: 0.01 }                 |
| -> solana transfer 0.01 SOL -> tx: 5Kj8...                  |
| -> Retry with X-Payment: 5Kj8...                            |
+-------------------------------------------------------------+
| STEP 4: INFER                                               |
| Result: [pos:78%, neg:15%, neutral:7%]                      |
| Metrics: 43ms, TEE verified, ZK verified                   |
+-------------------------------------------------------------+
| STEP 5: CHAIN -> DISCOVER (topic extraction)                |
| Feed sentiment output -> topic model                        |
| Found: TopicMine v2 (91%, 0.008 SOL, 4.5 stars)           |
| ... pay -> infer -> verify ...                              |
| Topics: [battery, screen quality, price value]              |
+-------------------------------------------------------------+
| STEP 6: CHAIN -> DISCOVER (summarization)                   |
| Feed all results -> summarizer model                         |
| ... pay -> infer -> verify ...                              |
| Summary: "Customers love screen quality (92% positive),     |
|  battery life is main concern (67% negative), price is      |
|  perceived as fair (81% positive)."                         |
+-------------------------------------------------------------+
| STEP 7: SUMMARIZE                                           |
| Total cost: 0.028 SOL                                       |
| Models used: 3                                              |
| All payments verified on Solana Explorer                    |
| All inferences TEE-attested                                |
+-------------------------------------------------------------+
```

---

## 7. STORAGE & ENCRYPTION LAYER

### 7.1 Model Upload Flow (Browser-Side)

```
1. Creator selects .onnx file (or .pt/.h5 that we convert to ONNX)
2. Browser generates random AES-256-GCM key (Web Crypto API)
   key = await crypto.subtle.generateKey({name:"AES-GCM", length:256}, true, ["encrypt","decrypt"])
3. Browser encrypts model file with the key
   iv = crypto.getRandomValues(new Uint8Array(12))
   encrypted = await crypto.subtle.encrypt({name:"AES-GCM", iv}, key, modelBytes)
4. Browser uploads encrypted blob to Pinata IPFS -> gets CID
5. Browser exports raw key bytes
   rawKey = await crypto.subtle.exportKey("raw", key)
6. Browser sends rawKey to Solana program (encrypted with TEE public key)
   -> Stored as private state in MagicBlock PER
7. On-chain: Model PDA stores CID, SHA-256(rawKey), TEE validator address
8. Key lifecycle: rawKey exists ONLY in browser (briefly) and TEE (permanently)
   -> NEVER on any server, NEVER in plaintext on IPFS, NEVER on-chain
```

### 7.2 Model Retrieval Flow (Compute Node)

```
1. Node receives inference request (assigned via VRF)
2. Node calls MagicBlock TEE endpoint:
   POST https://devnet-tee.magicblock.app/api/key/{model_pda}
   Headers: X-Node-Attestation: {tee_attestation_cert}
3. TEE validates:
   a. Node is in model's permission list
   b. Node has valid TEE attestation
   c. Payment for this inference has been verified
4. TEE returns: AES key (only valid for this session)
5. Node downloads encrypted model from IPFS:
   GET https://gateway.pinata.cloud/ipfs/{CID}
6. Node decrypts in memory:
   decrypted = AES-256-GCM.decrypt(encrypted, key, iv)
7. Node loads ONNX:
   session = onnxruntime.InferenceSession(decrypted_bytes)
8. Node runs inference, measures metrics, generates attestation
9. Node destroys key from memory after inference
```

---

## 8. VERIFICATION LAYER

### 8.1 EZKL ZK Proof (Pre-Generated, Verified On-Chain)

```
Pre-hackathon preparation:
1. Export MNIST model to ONNX: mnist.onnx
2. Create test input: test_input.json (batch of 100 MNIST images)
3. Generate EZKL settings:
   ezkl gen-settings -M mnist.onnx
4. Compile circuit:
   ezkl compile-circuit -M mnist.onnx -S settings.json
5. Setup trusted ceremony:
   ezkl setup --compiled-circuit circuit.ezkl --srs-path kzg.srs
6. Generate witness:
   ezkl gen-witness -M mnist.onnx -D test_input.json
7. Generate proof:
   ezkl prove --witness witness.json --compiled-circuit circuit.ezkl --pk pk.key
8. Export verifier

At demo time:
- Show pre-generated proof
- Run verify instruction on-chain
- Judges see: "This model provably achieves 94.2% accuracy on the test set"
- Nobody can fake this -- the math guarantees it
```

### 8.2 Reclaim Protocol zkTLS (GitHub Contribution Verification)

```
Flow:
1. Creator adds contributor during model registration
2. UI shows Reclaim SDK QR code / deep link
3. Contributor's browser opens GitHub (through Reclaim's TLS notary)
4. Reclaim generates proof: "This wallet owner made X commits to repo Y"
5. Proof submitted on-chain as part of add_contributor() instruction
6. Smart contract verifies proof hash, sets contribution_share
7. Nobody can claim someone else's commits -- the TLS session is notarized

Integration code:
import { Reclaim } from '@reclaimprotocol/js-sdk'

const reclaim = new Reclaim.ProofRequest('VAULT_APP_ID')
reclaim.addContext('github-contributions', {
    url: 'https://api.github.com/repos/{org}/{repo}/stats/contributors',
    method: 'GET',
    responseMatches: [{ type: 'contains', value: contributorGithubUsername }]
})
const proof = await reclaim.requestProof()
// Submit proof hash on-chain
```

### 8.3 TEE Attestation (MagicBlock)

```
Every inference response includes:
{
    "tee_attestation": {
        "enclave_measurement": "0x...",
        "runtime_hash": "0x...",
        "input_hash": "0x...",
        "output_hash": "0x...",
        "metrics_hash": "0x...",
        "timestamp": 1713460920,
        "signature": "0x..."
    }
}

Verification:
- Anyone can verify via MagicBlock SDK: verifyTeeRpcIntegrity(attestation)
- On-chain: store attestation_hash, verify signature in verify_inference()
- UI: Show green TEE badge with expandable attestation details
```

---

## 9. TOKENOMICS REFERENCE

### 9.1 Revenue Split Model

```
Inference Fee Breakdown:
+---------------------------------------------------+
| Total Inference Fee: 100%                         |
|                                                   |
| +-- Model Contributors: 70%                       |
| |   +-- Split by verified contribution shares     |
| |   |   (e.g., Dev1: 29.4%, Dev2: 19.6%,         |
| |   |    Dev3: 42.0%, Dev4: 9.0%)                 |
| |   +-- Or 70% to sole creator if no contributors |
|                                                   |
| +-- Compute Node: 25%                             |
| |   +-- Payment for running inference             |
| |   +-- Incentivizes node uptime + quality        |
|                                                   |
| +-- Protocol Treasury: 5%                         |
|     +-- Funds protocol development                |
|     +-- Funds bug bounties                        |
|     +-- Funds insurance pool for disputes         |
+---------------------------------------------------+

Subscription Fee Breakdown:
+---------------------------------------------------+
| Total Subscription: 100%                          |
|                                                   |
| +-- Model Contributors: 75%                       |
| +-- Compute Nodes (from usage pool): 20%          |
| +-- Protocol Treasury: 5%                         |
+---------------------------------------------------+

Ownership Sale:
+---------------------------------------------------+
| Total Sale Price: 100%                            |
|                                                   |
| +-- Current Owner: 100%                           |
| (Contributor shares do NOT apply to ownership      |
|  sale -- that's a separate asset transfer.        |
|  Contributor shares only apply to ongoing          |
|  inference/subscription revenue.)                 |
+---------------------------------------------------+
```

### 9.2 Compute Node Staking

```
Node Stake Tiers:
+---------------------------------------------------+
| Tier 1 (Basic):     1 SOL stake  -> Max 10 inf/hr |
| Tier 2 (Standard):  5 SOL stake  -> Max 50 inf/hr |
| Tier 3 (Premium):  10 SOL stake  -> Max 200 inf/hr|
+---------------------------------------------------+

Slashing Conditions:
- Failed TEE attestation: Slash 10% of stake
- Inference timeout (>30s): Slash 2% of stake
- Output tampering (detected via ZK): Slash 100% of stake
- Downtime >1hr: Slash 1% of stake per hour
```

### 9.3 Reputation System

```
Reputation Score (0-10000 basis points):

Model Reputation:
- Base: 5000 (neutral)
- Per positive rating: +50
- Per negative rating: -100
- Per ZK accuracy proof: +500
- Per 1000 inferences: +100
- Per TEE attestation failure: -500
- Decay: -10 per week (prevents stale models from staying on top)

Node Reputation:
- Base: 5000 (neutral)
- Per successful inference: +10
- Per failed inference: -200
- Per TEE attestation success: +50
- Uptime > 99%: +500
- Uptime < 95%: -500
- Stake > 10 SOL: +200 bonus
```

### 9.4 Bonding Curve (For Future Token)

```
VAULT Token (potential future governance token):

Bonding Curve for Model Access Pricing:
- As model usage increases, per-inference price decreases (economies of scale)
- Base price set by creator
- Discount tiers based on volume:
  +-- 1-100 inferences:    100% of base price
  +-- 101-1000 inferences:  90% of base price
  +-- 1001+ inferences:     80% of base price

Token Utility (future):
- Governance: Vote on protocol parameters (fee split, slashing, etc.)
- Staking: Stake VAULT to become a compute node (reduced stake requirement)
- Discounts: Hold VAULT for reduced inference fees
- Revenue Sharing: VAULT holders earn a portion of protocol treasury
```

### 9.5 SPL Token-2022 Extensions Used

```
Ownership Token (per model, supply=1):
+-- Permanent Delegate: Program can transfer token on behalf of owner (for buy_model)
+-- NonTransferable: OPTIONAL -- creator can lock token to prevent resale
+-- Transfer Hook: Custom validation on transfer (check model sale conditions)

Potential Future Token (VAULT):
+-- Transfer Hook: Fee collection on transfer
+-- Interest-Bearing Mint: Staking yields
+-- Confidential Transfer: Private balances (for MagicBlock PER integration)
```

---

## 10. DEPLOYMENT PLAN

```
Frontend:        Vercel (free tier)              -> vault.vercel.app
Backend:         Railway (free trial)            -> api.vault.railway.app
IPFS:            Pinata (free tier, 500MB)      -> gateway.pinata.cloud
Solana Program:  Devnet                          -> devnet.solana.com
MagicBlock ER:   Devnet ER validator             -> devnet-er.magicblock.app
MagicBlock TEE:  Devnet TEE validator            -> devnet-tee.magicblock.app
ORAO VRF:        Devnet                          -> VRFzZoJdhFWL8rkvu87LpKM3RbcVezpMEc6X5GVDr7y
```

### Devnet SOL Requirements

```
Program deployment: ~3 SOL
PDA creation (10 models): ~0.5 SOL
Inference payments (100 demo calls): ~1 SOL
VRF requests: ~0.5 SOL
Compute node stake: ~1 SOL
Buffer: ~4 SOL
---------------------
Total: ~10 SOL (free from devnet faucet, unlimited)
```

---

## 11. PRIORITY BUILD ORDER (24-Hour Sprint)

### Phase 1: Foundation (Hours 0-5)

| # | Task | Who | Time | Dependencies |
|---|------|-----|------|-------------|
| 1 | anchor init vault + project scaffold | You | 30m | None |
| 2 | Write ModelRegistry PDA + register_model instruction | You | 1h | #1 |
| 3 | Write InferenceRequest PDA + request_inference | You | 1h | #2 |
| 4 | Write ComputeNode PDA + register_node | You | 30m | #1 |
| 5 | Add SPL Token-2022 minting in register_model | You | 1h | #2 |
| 6 | Deploy to devnet + test with CLI | You | 1h | #2-5 |
| 7 | Clone CogniStream, strip content, add Solana wallet adapter | Mate 1 | 2h | None |
| 8 | Build ModelCard + ModelGrid + FilterBar components | Mate 1 | 3h | #7 |
| 9 | Set up FastAPI project, install onnxruntime, prepare 3 ONNX models | Mate 2 | 2h | None |
| 10 | Build /v1/inference endpoint with x402 middleware | Mate 2 | 3h | #9 |
| 11 | Set up Pinata API, build model AES encryption (browser JS) | Mate 3 | 2h | None |
| 12 | Build upload wizard UI (encrypt -> upload -> register) | Mate 3 | 3h | #11 |

### Phase 2: Core Integration (Hours 5-10)

| # | Task | Who | Time | Dependencies |
|---|------|-----|------|-------------|
| 13 | Add contributor shares + distribute_revenue + claim_revenue | You | 1.5h | #6 |
| 14 | Add transfer_ownership + list_for_sale + buy_model | You | 1h | #6 |
| 15 | Add MagicBlock ER delegation (update_reputation_er + commit) | You | 1.5h | #6 |
| 16 | Add ORAO VRF CPI for assign_node_vrf | You | 1h | #6 |
| 17 | Build Model Detail page with InferencePanel (MNIST canvas + text input) | Mate 1 | 3h | #8 |
| 18 | Build dashboard page (creator revenue, model stats) | Mate 1 | 2h | #17 |
| 19 | Wire FastAPI to Solana RPC (verify payments, report metrics) | Mate 2 | 2h | #10 |
| 20 | Add TEE attestation endpoint + metrics measurement | Mate 2 | 2h | #19 |
| 21 | Add Reclaim zkTLS flow in upload wizard | Mate 3 | 2h | #12 |
| 22 | Build MetricsDisplay + ContributorList + OwnershipBadge | Mate 3 | 2h | #12 |

### Phase 3: Agent + Demo (Hours 10-16)

| # | Task | Who | Time | Dependencies |
|---|------|-----|------|-------------|
| 23 | Build LangGraph agent (vault_agent.py) | You | 3h | #10, #6 |
| 24 | Build Visual Pipeline Builder (React Flow) | Mate 1 | 4h | #8 |
| 25 | Pre-compute EZKL ZK proof for MNIST model | Mate 2 | 2h | #9 |
| 26 | Add ElevenLabs voice narration to agent pipeline | Mate 2 | 1h | #23 |
| 27 | Build Privacy Proof page | Mate 3 | 3h | #22 |
| 28 | Wire WebSocket: agent terminal -> frontend real-time display | You | 1h | #23 |
| 29 | Build Agent Terminal UI component | Mate 1 | 1h | #24 |
| 30 | Add Mistral-powered model descriptions in upload flow | Mate 3 | 1h | #21 |

### Phase 4: Polish + Deploy (Hours 16-24)

| # | Task | Who | Time | Dependencies |
|---|------|-----|------|-------------|
| 31 | End-to-end test: upload -> discover -> pay -> infer -> verify -> chain | ALL | 2h | All |
| 32 | Fix broken flows, edge cases | ALL | 2h | #31 |
| 33 | Deploy frontend to Vercel | Mate 1 | 1h | #32 |
| 34 | Deploy backend to Railway | Mate 2 | 1h | #32 |
| 35 | Record backup demo video | ALL | 1h | #33-34 |
| 36 | Prepare pitch deck (7 slides) | You | 1h | #35 |

---

## 12. OUR MOAT

### vs Other Blockchain Teams at DJ Hack
They have: Basic smart contract + IPFS + wallet connect.
We have: 6 PDA types, 20+ instructions, ER/PER/VRF/TEE, ZK proofs, x402 agents, multi-owner revenue split, ownership transfer, TEE-attested metrics.

### vs AI/ML Teams at DJ Hack (Cross-Domain)
They have: A chatbot or an agent that does one thing.
We have: An autonomous agent that discovers, pays for, and chains multiple AI models from a decentralized marketplace with cryptographic proofs at every step.

### vs Other Teams at MagicBlock V4
They had: Private payments (privRoll), sealed bids (Veil), task escrow (TaskForest).
We have: The first project that combines ALL MagicBlock products (ER + PER/TEE + VRF + Private Payments + Permission Program + Magic Actions) into a single coherent system.

### The Unique Innovation
TEE-protected model weights + ZK-verified accuracy + x402 machine-to-machine payments + VRF fair compute selection + multi-owner revenue split with zkTLS GitHub verification. No other team combines all five.

---

## 13. TECH STACK SUMMARY

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Smart Contract | Anchor | 0.31.x | Solana program framework |
| Blockchain | Solana | Devnet | Base layer |
| L2 | MagicBlock ER | Latest | Zero-fee real-time state |
| TEE | MagicBlock PER | Latest | Private key vault |
| VRF | ORAO VRF | 0.4.x | Fair node selection |
| Frontend | Next.js | 15.x | React framework |
| Styling | Tailwind CSS | 4.x | Utility-first CSS |
| Animation | Framer Motion | 12.x | UI animations |
| Pipeline UI | React Flow | 12.x | Visual pipeline builder |
| Wallet | @solana/wallet-adapter | Latest | Phantom integration |
| Backend | FastAPI | Latest | Compute node API |
| Inference | ONNX Runtime | 1.18.x | Model execution |
| Encryption | AES-256-GCM | Web Crypto API | Model encryption |
| IPFS | Pinata | API v2 | Decentralized storage |
| zkTLS | Reclaim Protocol | JS SDK | GitHub contribution proofs |
| ZK Proofs | EZKL | Latest | Model accuracy verification |
| Agent | LangGraph | Latest | Agentic orchestration |
| x402 | x402 Protocol | Latest | Machine-to-machine payments |
| Voice | ElevenLabs | API v2 | Demo narration |
| AI Descriptions | Mistral | Small | Auto-generate model descriptions |
| Token | SPL Token-2022 | Latest | Model ownership NFT |
