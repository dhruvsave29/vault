import { Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export interface InferenceResult {
  prediction: any;
  confidence: number;
  probabilities?: number[];
  task_type: string;
  metrics: {
    inference_time_ms: number;
    input_tokens: number;
    output_tokens: number;
    memory_peak_kb: number;
  };
  attestation: {
    tee_attestation_hash: string;
    output_hash: string;
  };
  payment: {
    verified: boolean;
    signature: string;
  };
}

export interface PaymentRequired {
  status: string;
  pay_to: string;
  amount: number;
  amount_lamports: number;
  currency: string;
  network: string;
  model_id: string;
  model_name: string;
  accuracy: number;
}

export interface ModelInfo {
  model_id: number;
  owner: string;
  task_type: string;
  accuracy: number;
  price_per_use: number;
  subscription_price: number;
  inference_count: number;
  reputation_score: number;
  is_active: boolean;
  is_listed_for_sale: boolean;
  sale_price_sol: number;
  ownership_token_mint: string;
  contributors_count: number;
  contributors: Array<{ pubkey: string; share: number }>;
  ipfs_cid: string;
  name: string;
  created_at: string;
  framework_version: string;
}

function normalizeListModel(m: Record<string, any>): ModelInfo {
  const createdAtRaw = m.created_at ?? m.created_at_unix ?? 0;
  let createdAt = "";
  if (createdAtRaw && createdAtRaw > 0) {
    createdAt = new Date(createdAtRaw * 1000).toISOString();
  }
  return {
    model_id: m.model_id ?? 0,
    owner: m.owner ?? "",
    task_type: m.task_type ?? "classification",
    accuracy: (m.accuracy_claim ?? m.accuracy ?? 0) / 100,
    price_per_use: m.price_per_use_sol ?? m.price_sol ?? m.price_per_use ?? 0,
    subscription_price: m.subscription_price_sol ?? m.subscription_price ?? 0,
    inference_count: m.inference_count ?? 0,
    reputation_score: m.reputation_score ?? m.reputation ?? 0,
    is_active: m.is_active ?? true,
    is_listed_for_sale: m.is_listed_for_sale ?? false,
    sale_price_sol: m.sale_price_sol ?? 0,
    ownership_token_mint: m.ownership_token_mint ?? "",
    contributors_count: m.contributors_count ?? (Array.isArray(m.contributors) ? m.contributors.length : 0),
    contributors: Array.isArray(m.contributors) ? m.contributors : [],
    ipfs_cid: m.ipfs_cid ?? "",
    name: m.name ?? `Model #${m.model_id ?? 0}`,
    created_at: createdAt,
    framework_version: m.framework_version ?? "",
  };
}

export async function runInference(
  modelId: string,
  inputData: number[],
  walletPublicKey: PublicKey,
  sendTransaction: (tx: Transaction, connection: any) => Promise<string>,
  connection: any,
  inputText?: string
): Promise<InferenceResult> {
  const body: any = { input_data: inputData };
  if (inputText) body.input_text = inputText;

  const res1 = await fetch(`${BACKEND_URL}/v1/inference/${modelId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res1.status === 402) {
    const paymentInfo: PaymentRequired = await res1.json();

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: walletPublicKey,
        toPubkey: new PublicKey(paymentInfo.pay_to),
        lamports: paymentInfo.amount_lamports,
      })
    );

    const sig = await sendTransaction(tx, connection);

    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction(
      { signature: sig, blockhash: latestBlockhash.blockhash, lastValidBlockHeight: latestBlockhash.lastValidBlockHeight },
      "confirmed"
    );

    const res2 = await fetch(`${BACKEND_URL}/v1/inference/${modelId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Payment": sig,
      },
      body: JSON.stringify(body),
    });

    if (!res2.ok) {
      const errText = await res2.text().catch(() => res2.statusText);
      throw new Error(`Inference failed after payment: ${errText}`);
    }

    return res2.json();
  }

  if (res1.ok) {
    return res1.json();
  }

  throw new Error(`Unexpected response: ${res1.status}`);
}

export async function fetchModels(): Promise<ModelInfo[]> {
  const res = await fetch(`${BACKEND_URL}/v1/models`);
  if (!res.ok) throw new Error("Failed to fetch models");
  const data = await res.json();
  const raw: any[] = Array.isArray(data) ? data : (data.models ?? []);
  return raw.map(normalizeListModel);
}

export async function discoverModels(params: {
  task_type?: string;
  min_accuracy?: number;
  sort_by?: string;
}): Promise<ModelInfo[]> {
  const qs = new URLSearchParams();
  if (params.task_type) qs.set("task", params.task_type);
  if (params.min_accuracy) qs.set("min_accuracy", String(params.min_accuracy));
  if (params.sort_by) qs.set("sort_by", params.sort_by);
  const res = await fetch(`${BACKEND_URL}/v1/discover?${qs}`);
  if (!res.ok) throw new Error("Failed to discover models");
  const data = await res.json();
  const raw: any[] = Array.isArray(data) ? data : (data.models ?? []);
  return raw.map(normalizeListModel);
}

export async function uploadAndEncryptModel(
  file: File,
  metadata: {
    task_type: string;
    framework_version: string;
    accuracy_claim: number;
    price_per_use: number;
    subscription_price: number;
  }
): Promise<{ ipfs_cid: string; encryption_key_hash: string; encryption_key_hex: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("task_type", metadata.task_type);
  formData.append("framework_version", metadata.framework_version);
  formData.append("accuracy_claim", String(metadata.accuracy_claim));
  formData.append("price_per_use", String(metadata.price_per_use));
  formData.append("subscription_price", String(metadata.subscription_price));

  const res = await fetch(`${BACKEND_URL}/v1/models/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
  return res.json();
}
