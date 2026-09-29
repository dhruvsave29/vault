"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Shield,
  Lock,
  Cloud,
  Zap,
  ChevronDown,
  ArrowRight,
  ShoppingCart,
  ExternalLink,
  X,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { FloatingHeader } from "@/components/ui/floating-header";
import { GradientHeading } from "@/components/ui/gradient-heading";
import { Button } from "@/components/ui/button";
import { fetchModels, discoverModels, ModelInfo } from "@/lib/api/backend";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { cn } from "@/lib/utils";

const TASK_TYPES = [
  { value: "", label: "All" },
  { value: "classification", label: "Classification" },
  { value: "sentiment", label: "Sentiment" },
  { value: "summarization", label: "Summarization" },
  { value: "object_detection", label: "Object Detection" },
];

const SORT_OPTIONS = [
  { value: "accuracy", label: "Accuracy" },
  { value: "price", label: "Price" },
  { value: "popularity", label: "Popularity" },
];

const TASK_COLORS: Record<string, string> = {
  classification: "bg-indigo text-void border-indigo",
  sentiment: "bg-violet text-void border-violet",
  summarization: "bg-emerald text-void border-emerald",
  object_detection: "bg-amber text-void border-amber",
};

const EXPLORER_URL = "https://solscan.io/tx";

function truncatePubkey(pk: string) {
  if (!pk || pk.length < 12) return pk;
  return `${pk.slice(0, 4)}...${pk.slice(-4)}`;
}

function FilterBar({ taskType, setTaskType, minAccuracy, setMinAccuracy, sortBy, setSortBy }: {
  taskType: string; setTaskType: (v: string) => void; minAccuracy: number; setMinAccuracy: (v: number) => void; sortBy: string; setSortBy: (v: string) => void;
}) {
  return (
    <div className="bg-card border-brutal shadow-brutal p-4 flex flex-col md:flex-row gap-4 items-stretch md:items-end">
      <div className="flex-1 min-w-0">
        <label className="font-heading text-xs font-black uppercase tracking-wider text-text-muted mb-1 block">Task Type</label>
        <div className="relative">
          <select value={taskType} onChange={(e) => setTaskType(e.target.value)} className="w-full appearance-none bg-surface border-brutal px-4 py-3 font-mono text-sm font-bold text-text-primary focus:outline-none focus:border-indigo cursor-pointer">
            {TASK_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <label className="font-heading text-xs font-black uppercase tracking-wider text-text-muted mb-1 block">Min Accuracy: {minAccuracy}%</label>
        <input type="range" min={0} max={100} value={minAccuracy} onChange={(e) => setMinAccuracy(Number(e.target.value))} className="w-full accent-indigo h-2 cursor-pointer" />
      </div>
      <div className="flex-1 min-w-0">
        <label className="font-heading text-xs font-black uppercase tracking-wider text-text-muted mb-1 block">Sort By</label>
        <div className="relative">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full appearance-none bg-surface border-brutal px-4 py-3 font-mono text-sm font-bold text-text-primary focus:outline-none focus:border-indigo cursor-pointer">
            {SORT_OPTIONS.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
        </div>
      </div>
    </div>
  );
}

function ModelCard({ model, index, onBuy }: { model: ModelInfo; index: number; onBuy: (m: ModelInfo) => void }) {
  const modelId = model.model_id ?? 0;
  const modelName = model.name ?? `Model #${modelId}`;
  const taskType = model.task_type ?? "classification";
  const accuracy = model.accuracy ?? 0;
  const price = model.price_per_use ?? 0;
  const inferenceCount = model.inference_count ?? 0;
  const hasIpfs = !!model.ipfs_cid;
  const isListed = model.is_listed_for_sale;
  const salePrice = model.sale_price_sol ?? 0;
  const badgeClass = TASK_COLORS[taskType] ?? "bg-indigo text-void border-indigo";

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: index * 0.05 }} className="bg-card border-brutal shadow-brutal hover:-translate-y-1 transition-transform duration-200 flex flex-col">
      <div className="p-5 flex-1 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-heading text-lg font-black uppercase tracking-tight text-text-primary">{modelName}</h3>
          <div className="flex items-center gap-2">
            {isListed && salePrice > 0 && (<span className="px-2 py-0.5 text-[10px] font-heading font-black uppercase tracking-wider border-2 bg-emerald text-void border-emerald">FOR SALE {salePrice} SOL</span>)}
            <span className={cn("px-2 py-0.5 text-[10px] font-heading font-black uppercase tracking-wider border-2 shrink-0", badgeClass)}>{taskType.replace("_", " ")}</span>
          </div>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-heading text-4xl font-black text-text-primary tabular-nums">{(accuracy * 100).toFixed(1)}</span>
          <span className="font-mono text-sm font-bold text-text-muted">%</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-text-dim ml-1">accuracy</span>
        </div>
        <div className="flex items-center gap-4 font-mono text-sm">
          <span className="text-emerald font-bold">{price} SOL</span>
          <span className="text-text-muted">{inferenceCount.toLocaleString()} runs</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1">
          <span className="flex items-center gap-1 px-2 py-0.5 border-2 border-indigo/30 text-indigo text-[10px] font-mono font-bold uppercase"><Lock className="w-3 h-3" /> TEE</span>
          {hasIpfs && (<span className="flex items-center gap-1 px-2 py-0.5 border-2 border-violet/30 text-violet text-[10px] font-mono font-bold uppercase"><Cloud className="w-3 h-3" /> IPFS</span>)}
        </div>
      </div>
      <div className="border-t-4 border-border flex">
        {isListed && salePrice > 0 ? (
          <button onClick={() => onBuy(model)} className="flex-1 text-center py-3 font-heading text-xs font-black uppercase tracking-wider text-void bg-emerald hover:bg-emerald/80 transition-colors">
            <ShoppingCart className="w-3 h-3 inline mr-1" strokeWidth={3} /> Buy {salePrice} SOL
          </button>
        ) : (
          <Link href={`/inference?model=${modelId}`} className="flex-1 text-center py-3 font-heading text-xs font-black uppercase tracking-wider text-void bg-indigo hover:bg-violet transition-colors">
            <Zap className="w-3 h-3 inline mr-1" strokeWidth={3} /> Run
          </Link>
        )}
        <Link href={`/models/${modelId}`} className="flex-1 text-center py-3 font-heading text-xs font-black uppercase tracking-wider text-text-primary bg-surface hover:bg-card-hover border-l-4 border-border transition-colors">
          Details <ArrowRight className="w-3 h-3 inline ml-1" strokeWidth={3} />
        </Link>
      </div>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-card border-brutal shadow-brutal animate-pulse p-5 flex flex-col gap-3">
      <div className="h-5 w-2/3 bg-surface rounded-none" /><div className="h-10 w-1/3 bg-surface rounded-none" /><div className="h-4 w-1/2 bg-surface rounded-none" /><div className="h-6 w-full bg-surface rounded-none mt-2" /><div className="h-10 w-full bg-surface rounded-none" />
    </div>
  );
}

export default function MarketplacePage() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taskType, setTaskType] = useState("");
  const [minAccuracy, setMinAccuracy] = useState(0);
  const [sortBy, setSortBy] = useState("accuracy");

  const [buyModal, setBuyModal] = useState(false);
  const [buyModel, setBuyModel] = useState<ModelInfo | null>(null);
  const [buyLoading, setBuyLoading] = useState(false);
  const [buySig, setBuySig] = useState<string | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { publicKey, signTransaction, sendTransaction } = useWallet();
  const { connection } = useConnection();

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    (async () => {
      try {
        const data = taskType || minAccuracy > 0 || sortBy !== "accuracy"
          ? await discoverModels({ task_type: taskType || undefined, min_accuracy: minAccuracy > 0 ? minAccuracy / 100 : undefined, sort_by: sortBy })
          : await fetchModels();
        if (active) setModels(Array.isArray(data) ? data : []);
      } catch (e: any) { if (active) setError(e.message ?? "Failed to fetch models"); } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [taskType, minAccuracy, sortBy]);

  const handleBuyClick = (model: ModelInfo) => {
    setBuyModel(model); setBuyModal(true); setBuySig(null); setBuyError(null); setBuyLoading(false); setCopied(false);
  };

  const closeBuyModal = () => { setBuyModal(false); setBuyModel(null); setBuySig(null); setBuyError(null); setBuyLoading(false); };

  const handleBuy = async () => {
    if (!publicKey || !buyModel) return;
    setBuyLoading(true); setBuyError(null);
    try {
      const ownerPk = new PublicKey(buyModel.owner);
      const lamports = Math.round(buyModel.sale_price_sol * LAMPORTS_PER_SOL);
      const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: ownerPk, lamports }));
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;
      let sig: string;
      if (signTransaction) {
        const signed = await signTransaction(tx);
        const raw = signed.serialize();
        sig = await connection.sendRawTransaction(raw, { skipPreflight: false, preflightCommitment: "confirmed" });
      } else {
        sig = await sendTransaction(tx, connection, { skipPreflight: false });
      }
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
      setBuySig(sig);
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("Insufficient")) setBuyError("Insufficient SOL balance");
      else setBuyError(msg.slice(0, 200) || "Transaction failed");
    } finally { setBuyLoading(false); }
  };

  return (
    <div className="min-h-screen bg-void font-mono relative bg-noise overflow-x-hidden">
      <div className="fixed inset-0 bg-dot-pattern opacity-100 pointer-events-none z-0" />
      <div className="relative z-50 pt-4"><FloatingHeader /></div>
      <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 py-8 mt-6">
        <GradientHeading variant="indigo" size="lg" className="mb-6">MODEL MARKETPLACE</GradientHeading>
        <FilterBar taskType={taskType} setTaskType={setTaskType} minAccuracy={minAccuracy} setMinAccuracy={setMinAccuracy} sortBy={sortBy} setSortBy={setSortBy} />

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">{Array.from({ length: 6 }).map((_, i) => (<SkeletonCard key={i} />))}</div>
        ) : error ? (
          <div className="mt-12 text-center"><p className="font-heading text-xl font-black uppercase text-rose">Error: {error}</p></div>
        ) : models.length === 0 ? (
          <div className="mt-12 text-center"><p className="font-heading text-2xl font-black uppercase text-text-muted mb-4">No models found</p><Link href="/upload"><Button variant="outline" size="lg">Upload a Model</Button></Link></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {models.map((model, i) => (<ModelCard key={model.model_id ?? i} model={model} index={i} onBuy={handleBuyClick} />))}
          </div>
        )}
      </main>

      {/* Buy Modal — simple SOL payment */}
      {buyModal && buyModel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-void/80 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) closeBuyModal(); }}>
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.2 }} className="bg-card border-brutal shadow-brutal-glow glow-emerald p-6 w-full max-w-lg relative">
            <button onClick={closeBuyModal} className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"><X className="w-5 h-5" /></button>
            <h3 className="font-heading text-lg font-black uppercase tracking-wider text-text-primary mb-2">
              <ShoppingCart className="w-5 h-5 inline mr-2 text-emerald" />Purchase {buyModel.name ?? `Model #${buyModel.model_id}`}
            </h3>
            <div className="bg-surface border-2 border-emerald/30 p-4 mb-4">
              <p className="font-mono text-xs text-text-dim">Price</p>
              <p className="font-heading text-3xl font-black text-emerald">{buyModel.sale_price_sol} <span className="text-lg text-text-muted">SOL</span></p>
              <p className="font-mono text-[10px] text-text-dim mt-1">Owner: <span className="text-indigo font-bold">{truncatePubkey(buyModel.owner)}</span></p>
            </div>

            {!publicKey ? (
              <p className="font-mono text-xs text-amber mb-3">Connect your wallet to purchase</p>
            ) : buySig ? (
              <>
                <div className="bg-surface border-2 border-emerald/30 p-4">
                  <p className="font-mono text-xs font-bold text-emerald uppercase mb-2">Payment Successful</p>
                  <a href={`${EXPLORER_URL}/${buySig}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-mono text-sm font-bold text-indigo hover:text-violet transition-colors break-all">
                    <ExternalLink className="w-4 h-4 shrink-0" />{buySig.slice(0, 20)}...{buySig.slice(-8)}
                  </a>
                </div>
                <div className="bg-surface border-2 border-amber/30 p-4 mt-4">
                  <p className="font-mono text-xs font-bold text-amber mb-2">Step 2: Ownership Transfer</p>
                  <p className="font-mono text-xs text-text-muted mb-2">Share your wallet address with the owner so they can transfer the model NFT to you:</p>
                  <div className="flex items-center gap-2 bg-void border-2 border-border p-2">
                    <p className="font-mono text-xs font-bold text-indigo break-all flex-1">{publicKey.toBase58()}</p>
                    <button className="shrink-0 p-2 hover:bg-indigo/20 transition-colors" onClick={() => { navigator.clipboard.writeText(publicKey.toBase58()); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                      {copied ? <Check className="w-4 h-4 text-emerald" /> : <Copy className="w-4 h-4 text-text-muted" />}
                    </button>
                  </div>
                  <p className="font-mono text-[10px] text-text-dim mt-2">The owner will use "Transfer Ownership" with your address</p>
                </div>
              </>
            ) : (
              <>
                {buyError && <p className="font-mono text-xs font-bold text-rose mb-3">{buyError}</p>}
                <Button variant="emerald" size="lg" className="w-full" onClick={handleBuy} disabled={buyLoading}>
                  {buyLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</> : <><ShoppingCart className="w-4 h-4 mr-2" />Send {buyModel.sale_price_sol} SOL</>}
                </Button>
              </>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
