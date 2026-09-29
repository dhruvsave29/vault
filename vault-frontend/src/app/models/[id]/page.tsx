"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Shield,
  Lock,
  Cloud,
  Users,
  Zap,
  DollarSign,
  Tag,
  UserPlus,
  BarChart3,
  Hash,
  Clock,
  Award,
  ArrowRight,
  ExternalLink,
  X,
  Send,
  Loader2,
  ShoppingCart,
  Copy,
  Check,
} from "lucide-react";
import { FloatingHeader } from "@/components/ui/floating-header";
import { GradientHeading } from "@/components/ui/gradient-heading";
import { Button } from "@/components/ui/button";
import { fetchModels, ModelInfo } from "@/lib/api/backend";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { buildTransferOwnershipTx } from "@/lib/solana/transfer-ownership";
import { buildListForSaleTx } from "@/lib/solana/list-for-sale";
import { buildAddContributorTx } from "@/lib/solana/add-contributor";
import { cn } from "@/lib/utils";

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

function ModalOverlay({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-void/80 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.2 }} className="bg-card border-brutal shadow-brutal-glow glow-indigo p-6 w-full max-w-lg relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"><X className="w-5 h-5" /></button>
        {children}
      </motion.div>
    </div>
  );
}

function TxResult({ sig, label }: { sig: string; label: string }) {
  return (
    <div className="bg-surface border-2 border-emerald/30 p-4 mt-4">
      <p className="font-mono text-xs font-bold text-emerald uppercase mb-2">{label} Successful</p>
      <a href={`${EXPLORER_URL}/${sig}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-mono text-sm font-bold text-indigo hover:text-violet transition-colors break-all">
        <ExternalLink className="w-4 h-4 shrink-0" />{sig.slice(0, 20)}...{sig.slice(-8)}
      </a>
      <p className="font-mono text-[10px] text-text-dim mt-1">Click to view on Solscan (Devnet)</p>
    </div>
  );
}

export default function ModelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const [transferModal, setTransferModal] = useState(false);
  const [listModal, setListModal] = useState(false);
  const [contributorModal, setContributorModal] = useState(false);
  const [buyModal, setBuyModal] = useState(false);

  const [transferAddr, setTransferAddr] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [contribAddr, setContribAddr] = useState("");
  const [contribShare, setContribShare] = useState("");

  const [txLoading, setTxLoading] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [txLabel, setTxLabel] = useState("");
  const [copied, setCopied] = useState(false);

  const { publicKey, signTransaction, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const signAndSendTx = async (tx: any): Promise<string> => {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = publicKey!;
    if (signTransaction) {
      const signed = await signTransaction(tx);
      const raw = signed.serialize();
      const sig = await connection.sendRawTransaction(raw, { skipPreflight: false, preflightCommitment: "confirmed" });
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
      return sig;
    }
    return await sendTransaction(tx, connection, { skipPreflight: false });
  };

  const extractError = (err: any): string => {
    const msg = err?.message || String(err?.reason || "");
    const logs = err?.logs || err?.errorLogs || err?.data?.logs || [];
    const logStr = Array.isArray(logs) ? logs.join("\n") : "";
    const inner = err?.cause?.message || "";
    const combined = [msg, logStr, inner].filter(Boolean).join(" — ");
    if (combined.includes("custom program error")) {
      const m = combined.match(/custom program error: 0x(\w+)/);
      if (m) return `Program error: 0x${m[1]} — see Solscan for details`;
    }
    if (combined.includes("Already in use") || combined.includes("Already exists")) return "Account already exists on-chain";
    if (combined.includes("InsufficientFunds")) return "Insufficient SOL balance";
    if (combined.includes("0x1")) return "Insufficient balance or account not found";
    if (combined.includes("Invalid")) return combined.slice(0, 200);
    if (combined.includes("simulation")) return combined.slice(0, 200);
    if (msg) return msg.slice(0, 200);
    return "Transaction failed — check wallet balance and try again";
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await fetchModels();
        if (active) setModels(Array.isArray(data) ? data : []);
      } catch { } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  const model = useMemo(() => models.find((m) => String(m.model_id) === id), [models, id]);

  const isOwner = useMemo(() => {
    if (!model || !publicKey) return false;
    return model.owner === publicKey.toBase58();
  }, [model, publicKey]);

  const hasOwnershipMint = useMemo(() => {
    if (!model) return false;
    const mint = model.ownership_token_mint ?? "";
    return mint !== "" && mint !== "11111111111111111111111111111111";
  }, [model]);

  const resetTxState = () => { setTxSig(null); setTxError(null); setTxLoading(false); setTxLabel(""); };

  const closeAllModals = () => {
    setTransferModal(false); setListModal(false); setContributorModal(false); setBuyModal(false);
    resetTxState(); setTransferAddr(""); setListPrice(""); setContribAddr(""); setContribShare(""); setCopied(false);
  };

  const handleTransferOwnership = async () => {
    if (!publicKey) return;
    setTxLoading(true); setTxError(null); setTxSig(null); setTxLabel("Transfer Ownership");
    try {
      if (!hasOwnershipMint) throw new Error("This model has no ownership NFT minted. Ownership transfer is only available for models with Token-2022 mints (model #3+).");
      const newOwner = new PublicKey(transferAddr.trim());
      const modelId = Number(id);
      const tx = await buildTransferOwnershipTx(publicKey, newOwner, modelId, connection);
      const sig = await signAndSendTx(tx);
      setTxSig(sig);
    } catch (err: any) { setTxError(extractError(err)); } finally { setTxLoading(false); }
  };

  const handleListForSale = async () => {
    if (!publicKey) return;
    setTxLoading(true); setTxError(null); setTxSig(null); setTxLabel("List for Sale");
    try {
      const priceSol = parseFloat(listPrice);
      if (isNaN(priceSol) || priceSol <= 0) throw new Error("Invalid price");
      const modelId = Number(id);
      const tx = await buildListForSaleTx(publicKey, modelId, priceSol, connection);
      const sig = await signAndSendTx(tx);
      setTxSig(sig);
    } catch (err: any) { setTxError(extractError(err)); } finally { setTxLoading(false); }
  };

  const handleAddContributor = async () => {
    if (!publicKey) return;
    setTxLoading(true); setTxError(null); setTxSig(null); setTxLabel("Add Contributor");
    try {
      const contributor = new PublicKey(contribAddr.trim());
      const share = parseFloat(contribShare);
      if (isNaN(share) || share <= 0 || share > 100) throw new Error("Share must be 1-100");
      const modelId = Number(id);
      const tx = await buildAddContributorTx(publicKey, modelId, contributor, share, connection);
      const sig = await signAndSendTx(tx);
      setTxSig(sig);
    } catch (err: any) { setTxError(extractError(err)); } finally { setTxLoading(false); }
  };

  const handleBuy = async () => {
    if (!publicKey || !model) return;
    setTxLoading(true); setTxError(null); setTxSig(null); setTxLabel("Payment");
    try {
      const ownerPk = new PublicKey(model.owner);
      const lamports = Math.round(model.sale_price_sol * LAMPORTS_PER_SOL);
      const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: ownerPk, lamports }));
      const sig = await signAndSendTx(tx);
      setTxSig(sig);
    } catch (err: any) { setTxError(extractError(err)); } finally { setTxLoading(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-void font-mono relative bg-noise overflow-x-hidden">
        <div className="fixed inset-0 bg-dot-pattern opacity-100 pointer-events-none z-0" />
        <div className="relative z-50 pt-4"><FloatingHeader /></div>
        <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 py-8 mt-6">
          <div className="animate-pulse space-y-4"><div className="h-10 w-1/3 bg-card rounded-none" /><div className="h-64 w-full bg-card rounded-none" /></div>
        </main>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="min-h-screen bg-void font-mono relative bg-noise overflow-x-hidden">
        <div className="fixed inset-0 bg-dot-pattern opacity-100 pointer-events-none z-0" />
        <div className="relative z-50 pt-4"><FloatingHeader /></div>
        <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 py-8 mt-6">
          <GradientHeading variant="indigo" size="lg" className="mb-6">MODEL NOT FOUND</GradientHeading>
          <Link href="/marketplace"><Button variant="outline">Back to Marketplace</Button></Link>
        </main>
      </div>
    );
  }

  const modelName = model.name ?? `Model #${id}`;
  const taskType = model.task_type ?? "classification";
  const accuracy = model.accuracy ?? 0;
  const pricePerUse = model.price_per_use ?? 0;
  const subscriptionPrice = model.subscription_price ?? 0;
  const inferenceCount = model.inference_count ?? 0;
  const owner = model.owner ?? "Unknown";
  const ipfsCid = model.ipfs_cid ?? "";
  const reputation = model.reputation_score ?? 0;
  const createdAt = model.created_at ?? "";
  const hasIpfs = !!ipfsCid;
  const isMultiOwner = model.contributors && model.contributors.length > 1;
  const contributors = model.contributors ?? [];
  const isListed = model.is_listed_for_sale;
  const salePrice = model.sale_price_sol ?? 0;
  const badgeClass = TASK_COLORS[taskType] ?? "bg-indigo text-void border-indigo";

  const canBuy = !isOwner && isListed && salePrice > 0 && !!publicKey;

  return (
    <div className="min-h-screen bg-void font-mono relative bg-noise overflow-x-hidden">
      <div className="fixed inset-0 bg-dot-pattern opacity-100 pointer-events-none z-0" />
      <div className="relative z-50 pt-4"><FloatingHeader /></div>
      <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 py-8 mt-6">
        <GradientHeading variant="indigo" size="lg" className="mb-6">{modelName}</GradientHeading>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="bg-card border-brutal shadow-brutal p-6">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h2 className="font-heading text-2xl font-black uppercase tracking-tight text-text-primary mb-1">{modelName}</h2>
                  <p className="font-mono text-sm text-text-muted">Owner: <span className="text-indigo font-bold">{truncatePubkey(owner)}</span></p>
                </div>
                <div className="flex items-center gap-2">
                  {isListed && salePrice > 0 && (<span className="px-3 py-1 text-xs font-heading font-black uppercase tracking-wider border-2 bg-emerald text-void border-emerald animate-pulse">FOR SALE {salePrice} SOL</span>)}
                  <span className={cn("px-3 py-1 text-xs font-heading font-black uppercase tracking-wider border-2 shrink-0", badgeClass)}>{taskType.replace("_", " ")}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-surface border-2 border-border p-4">
                  <div className="flex items-center gap-2 mb-1"><BarChart3 className="w-4 h-4 text-emerald" strokeWidth={3} /><span className="font-mono text-[10px] uppercase tracking-wider text-text-dim font-bold">Accuracy</span></div>
                  <p className="font-heading text-3xl font-black text-text-primary tabular-nums">{(accuracy * 100).toFixed(1)}<span className="text-lg text-text-muted">%</span></p>
                </div>
                <div className="bg-surface border-2 border-border p-4">
                  <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-emerald" strokeWidth={3} /><span className="font-mono text-[10px] uppercase tracking-wider text-text-dim font-bold">Price / Use</span></div>
                  <p className="font-heading text-3xl font-black text-emerald tabular-nums">{pricePerUse}<span className="text-lg text-text-muted"> SOL</span></p>
                </div>
                <div className="bg-surface border-2 border-border p-4">
                  <div className="flex items-center gap-2 mb-1"><Hash className="w-4 h-4 text-violet" strokeWidth={3} /><span className="font-mono text-[10px] uppercase tracking-wider text-text-dim font-bold">Inferences</span></div>
                  <p className="font-heading text-3xl font-black text-text-primary tabular-nums">{inferenceCount.toLocaleString()}</p>
                </div>
                <div className="bg-surface border-2 border-border p-4">
                  <div className="flex items-center gap-2 mb-1"><Tag className="w-4 h-4 text-indigo" strokeWidth={3} /><span className="font-mono text-[10px] uppercase tracking-wider text-text-dim font-bold">Subscription</span></div>
                  <p className="font-heading text-xl font-black text-text-primary tabular-nums">{subscriptionPrice}<span className="text-sm text-text-muted"> SOL/mo</span></p>
                </div>
                <div className="bg-surface border-2 border-border p-4">
                  <div className="flex items-center gap-2 mb-1"><Award className="w-4 h-4 text-amber" strokeWidth={3} /><span className="font-mono text-[10px] uppercase tracking-wider text-text-dim font-bold">Reputation</span></div>
                  <p className="font-heading text-xl font-black text-text-primary tabular-nums">{typeof reputation === "number" ? reputation.toFixed(1) : reputation}</p>
                </div>
                <div className="bg-surface border-2 border-border p-4">
                  <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-text-muted" strokeWidth={3} /><span className="font-mono text-[10px] uppercase tracking-wider text-text-dim font-bold">Created</span></div>
                  <p className="font-mono text-sm font-bold text-text-primary">{createdAt ? new Date(createdAt).toLocaleDateString() : "N/A"}</p>
                </div>
              </div>

              {ipfsCid && (<div className="bg-surface border-2 border-border p-4 mb-6"><span className="font-mono text-[10px] uppercase tracking-wider text-text-dim font-bold block mb-1">IPFS CID</span><p className="font-mono text-sm font-bold text-violet break-all">{ipfsCid}</p></div>)}

              <div className="flex flex-wrap gap-2">
                <span className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-indigo/30 text-indigo text-xs font-mono font-bold uppercase glow-indigo"><Lock className="w-3.5 h-3.5" /> TEE Protected</span>
                {hasIpfs && (<span className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-violet/30 text-violet text-xs font-mono font-bold uppercase glow-violet"><Cloud className="w-3.5 h-3.5" /> IPFS Stored</span>)}
                {isMultiOwner && (<span className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-indigo/30 text-indigo text-xs font-mono font-bold uppercase glow-indigo"><Users className="w-3.5 h-3.5" /> Multi-Owner</span>)}
              </div>
            </motion.div>

            {isOwner && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="bg-card border-brutal-accent shadow-brutal-glow glow-indigo p-6">
                <h3 className="font-heading text-sm font-black uppercase tracking-wider text-text-muted mb-4">Owner Actions</h3>
                {!hasOwnershipMint && (
                  <div className="bg-amber/10 border-2 border-amber/30 p-3 mb-4">
                    <p className="font-mono text-xs font-bold text-amber">This model has no ownership NFT. Transfer/Buy only works for models #3+. Use a model registered through the Upload page.</p>
                  </div>
                )}
                {isListed && (
                  <div className="bg-emerald/10 border-2 border-emerald/30 p-3 mb-4">
                    <p className="font-mono text-xs font-bold text-emerald">Already listed for sale at {salePrice} SOL. Use "Transfer Ownership" to send to a buyer after they pay.</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" size="sm" onClick={() => { resetTxState(); setTransferModal(true); }} disabled={!hasOwnershipMint}>
                    <Send className="w-4 h-4 mr-1" /> Transfer Ownership
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { resetTxState(); setListModal(true); }} disabled={isListed}>
                    <Tag className="w-4 h-4 mr-1" /> {isListed ? "Already Listed" : "List for Sale"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { resetTxState(); setContributorModal(true); }}>
                    <UserPlus className="w-4 h-4 mr-1" /> Add Contributor
                  </Button>
                </div>
              </motion.div>
            )}

            {canBuy && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="bg-card border-brutal-accent shadow-brutal-glow glow-emerald p-6">
                <h3 className="font-heading text-sm font-black uppercase tracking-wider text-emerald mb-4">This Model is For Sale</h3>
                <div className="bg-surface border-2 border-emerald/30 p-4 mb-4">
                  <p className="font-mono text-xs text-text-dim">Price</p>
                  <p className="font-heading text-3xl font-black text-emerald">{salePrice} <span className="text-lg text-text-muted">SOL</span></p>
                  <p className="font-mono text-[10px] text-text-dim mt-1">Payment goes to: <span className="text-indigo font-bold">{truncatePubkey(owner)}</span></p>
                </div>
                <Button variant="emerald" size="lg" className="w-full" onClick={() => { resetTxState(); setBuyModal(true); }}>
                  <ShoppingCart className="w-4 h-4 mr-2" /> Purchase for {salePrice} SOL
                </Button>
              </motion.div>
            )}

            {contributors.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }} className="bg-card border-brutal shadow-brutal p-6">
                <h3 className="font-heading text-sm font-black uppercase tracking-wider text-text-muted mb-4">Contributors</h3>
                <div className="space-y-2">
                  {contributors.map((c, i) => (
                    <div key={i} className="flex items-center justify-between bg-surface border-2 border-border px-4 py-3">
                      <span className="font-mono text-sm font-bold text-text-primary">{truncatePubkey(c.pubkey)}</span>
                      <span className="font-heading text-sm font-black text-indigo">{c.share}%</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          <div className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }} className="bg-card border-brutal-accent shadow-brutal-glow glow-indigo p-6 sticky top-24">
              <h3 className="font-heading text-sm font-black uppercase tracking-wider text-text-muted mb-4">Quick Actions</h3>
              <Link href={`/inference?model=${id}`}><Button variant="default" size="lg" className="w-full mb-3"><Zap className="w-4 h-4 mr-2" strokeWidth={3} /> Run Inference</Button></Link>
              <Link href="/marketplace"><Button variant="outline" size="lg" className="w-full"><ArrowRight className="w-4 h-4 mr-2" strokeWidth={3} /> Back to Marketplace</Button></Link>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Buy Modal — simple SOL payment */}
      <ModalOverlay open={buyModal} onClose={closeAllModals}>
        <h3 className="font-heading text-lg font-black uppercase tracking-wider text-text-primary mb-4">
          <ShoppingCart className="w-5 h-5 inline mr-2 text-emerald" />Purchase Model #{id}
        </h3>
        <p className="font-mono text-xs text-text-muted mb-4">
          Send <span className="text-emerald font-bold">{salePrice} SOL</span> to the owner. After payment, the owner will transfer ownership to you.
        </p>
        <div className="bg-surface border-2 border-border p-3 mb-4">
          <p className="font-mono text-[10px] text-text-dim">Your wallet (buyer)</p>
          <p className="font-mono text-xs font-bold text-text-primary break-all">{publicKey?.toBase58()}</p>
        </div>
        <div className="bg-surface border-2 border-emerald/30 p-3 mb-4">
          <p className="font-mono text-[10px] text-text-dim">Sending to (owner)</p>
          <p className="font-mono text-xs font-bold text-indigo break-all">{owner}</p>
          <p className="font-mono text-[10px] text-text-dim mt-1">Amount: <span className="text-emerald font-bold">{salePrice} SOL</span></p>
        </div>
        {txError && <p className="font-mono text-xs font-bold text-rose mb-3">{txError}</p>}
        {txSig ? (
          <>
            <TxResult sig={txSig} label={txLabel} />
            <div className="bg-surface border-2 border-amber/30 p-4 mt-4">
              <p className="font-mono text-xs font-bold text-amber mb-2">Step 2: Ask the owner to transfer ownership</p>
              <p className="font-mono text-xs text-text-muted mb-2">Share your wallet address with the owner so they can transfer the model NFT to you:</p>
              <div className="flex items-center gap-2 bg-void border-2 border-border p-2">
                <p className="font-mono text-xs font-bold text-indigo break-all flex-1">{publicKey?.toBase58()}</p>
                <button
                  className="shrink-0 p-2 hover:bg-indigo/20 transition-colors"
                  onClick={() => { navigator.clipboard.writeText(publicKey?.toBase58() || ""); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                >
                  {copied ? <Check className="w-4 h-4 text-emerald" /> : <Copy className="w-4 h-4 text-text-muted" />}
                </button>
              </div>
              <p className="font-mono text-[10px] text-text-dim mt-2">Owner uses "Transfer Ownership" button with your address above</p>
            </div>
          </>
        ) : (
          <Button variant="emerald" size="lg" className="w-full" onClick={handleBuy} disabled={txLoading}>
            {txLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</> : <><ShoppingCart className="w-4 h-4 mr-2" />Send {salePrice} SOL</>}
          </Button>
        )}
      </ModalOverlay>

      {/* Transfer Ownership Modal */}
      <ModalOverlay open={transferModal} onClose={closeAllModals}>
        <h3 className="font-heading text-lg font-black uppercase tracking-wider text-text-primary mb-4">
          <Send className="w-5 h-5 inline mr-2 text-indigo" />Transfer Ownership
        </h3>
        <p className="font-mono text-xs text-text-muted mb-4">
          Transfer model #{id} to a new wallet. This is irreversible.
        </p>
        {!hasOwnershipMint && (
          <div className="bg-rose/10 border-2 border-rose/30 p-3 mb-4">
            <p className="font-mono text-xs font-bold text-rose">Cannot transfer — this model has no ownership NFT mint. Only models registered via Upload (model #3+) support this.</p>
          </div>
        )}
        <label className="font-mono text-[10px] uppercase tracking-wider text-text-dim font-bold block mb-1">New Owner Wallet Address</label>
        <input type="text" value={transferAddr} onChange={(e) => setTransferAddr(e.target.value)} placeholder="Enter buyer's Solana wallet address..." className="w-full bg-surface border-brutal px-4 py-3 font-mono text-sm font-bold text-text-primary focus:outline-none focus:border-indigo mb-4" disabled={txLoading || !hasOwnershipMint} />
        {txError && <p className="font-mono text-xs font-bold text-rose mb-3">{txError}</p>}
        {txSig ? (
          <TxResult sig={txSig} label={txLabel} />
        ) : (
          <Button variant="default" size="lg" className="w-full" onClick={handleTransferOwnership} disabled={txLoading || !transferAddr.trim() || !hasOwnershipMint}>
            {txLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing...</> : <><Send className="w-4 h-4 mr-2" />Confirm Transfer</>}
          </Button>
        )}
      </ModalOverlay>

      {/* List for Sale Modal */}
      <ModalOverlay open={listModal} onClose={closeAllModals}>
        <h3 className="font-heading text-lg font-black uppercase tracking-wider text-text-primary mb-4">
          <Tag className="w-5 h-5 inline mr-2 text-emerald" />List for Sale
        </h3>
        <p className="font-mono text-xs text-text-muted mb-4">Set a sale price for model #{id}. Buyers can purchase on the marketplace.</p>
        <label className="font-mono text-[10px] uppercase tracking-wider text-text-dim font-bold block mb-1">Sale Price (SOL)</label>
        <input type="number" step="0.01" min="0.001" value={listPrice} onChange={(e) => setListPrice(e.target.value)} placeholder="e.g. 0.5" className="w-full bg-surface border-brutal px-4 py-3 font-mono text-sm font-bold text-text-primary focus:outline-none focus:border-indigo mb-4" disabled={txLoading} />
        {txError && <p className="font-mono text-xs font-bold text-rose mb-3">{txError}</p>}
        {txSig ? (<TxResult sig={txSig} label={txLabel} />) : (
          <Button variant="emerald" size="lg" className="w-full" onClick={handleListForSale} disabled={txLoading || !listPrice}>
            {txLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing...</> : <><Tag className="w-4 h-4 mr-2" />List on Marketplace</>}
          </Button>
        )}
      </ModalOverlay>

      {/* Add Contributor Modal */}
      <ModalOverlay open={contributorModal} onClose={closeAllModals}>
        <h3 className="font-heading text-lg font-black uppercase tracking-wider text-text-primary mb-4">
          <UserPlus className="w-5 h-5 inline mr-2 text-violet" />Add Contributor
        </h3>
        <p className="font-mono text-xs text-text-muted mb-4">Add a contributor to model #{id} with a revenue share percentage.</p>
        <label className="font-mono text-[10px] uppercase tracking-wider text-text-dim font-bold block mb-1">Contributor Wallet Address</label>
        <input type="text" value={contribAddr} onChange={(e) => setContribAddr(e.target.value)} placeholder="Enter Solana wallet address..." className="w-full bg-surface border-brutal px-4 py-3 font-mono text-sm font-bold text-text-primary focus:outline-none focus:border-indigo mb-3" disabled={txLoading} />
        <label className="font-mono text-[10px] uppercase tracking-wider text-text-dim font-bold block mb-1">Revenue Share (%)</label>
        <input type="number" step="1" min="1" max="100" value={contribShare} onChange={(e) => setContribShare(e.target.value)} placeholder="e.g. 50" className="w-full bg-surface border-brutal px-4 py-3 font-mono text-sm font-bold text-text-primary focus:outline-none focus:border-indigo mb-4" disabled={txLoading} />
        {txError && <p className="font-mono text-xs font-bold text-rose mb-3">{txError}</p>}
        {txSig ? (<TxResult sig={txSig} label={txLabel} />) : (
          <Button variant="secondary" size="lg" className="w-full" onClick={handleAddContributor} disabled={txLoading || !contribAddr.trim() || !contribShare}>
            {txLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing...</> : <><UserPlus className="w-4 h-4 mr-2" />Add Contributor</>}
          </Button>
        )}
      </ModalOverlay>
    </div>
  );
}
