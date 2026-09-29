"use client";

import React, { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  File,
  Shield,
  Database,
  Link2,
  Check,
  Copy,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Lock,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { FloatingHeader } from "@/components/ui/floating-header";
import { GradientHeading } from "@/components/ui/gradient-heading";
import { Button } from "@/components/ui/button";
import { uploadAndEncryptModel } from "@/lib/api/backend";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { buildRegisterModelTx } from "@/lib/solana/register-model";

const STEPS = [
  { label: "Select File", icon: File },
  { label: "Set Metadata", icon: Database },
  { label: "Encrypt & Upload", icon: Lock },
  { label: "Register On-Chain", icon: Link2 },
];

const ACCEPTED_EXTENSIONS = [".onnx", ".pt", ".h5", ".pkl"];
const MAX_FILE_SIZE = 100 * 1024 * 1024;

const TASK_TYPES = [
  "Classification",
  "Sentiment",
  "Summarization",
  "Object Detection",
];

interface Metadata {
  task_type: string;
  framework_version: string;
  accuracy_claim: number;
  price_per_use: number;
  subscription_price: number;
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

export default function UploadPage() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<Metadata>({
    task_type: "",
    framework_version: "",
    accuracy_claim: 50,
    price_per_use: 0,
    subscription_price: 0,
  });
  const [metaErrors, setMetaErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadPhase, setUploadPhase] = useState(0);
  const [cid, setCid] = useState("");
  const [keyHash, setKeyHash] = useState("");
  const [keyHex, setKeyHex] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [registerTxSig, setRegisterTxSig] = useState("");
  const [registeredModelId, setRegisteredModelId] = useState<number | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const goNext = useCallback(() => {
    setDirection(1);
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  const validateFile = useCallback((f: File): boolean => {
    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setFileError(`Invalid format. Accepted: ${ACCEPTED_EXTENSIONS.join(", ")}`);
      return false;
    }
    if (f.size > MAX_FILE_SIZE) {
      setFileError("File exceeds 100MB limit");
      return false;
    }
    setFileError(null);
    return true;
  }, []);

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f && validateFile(f)) setFile(f);
    },
    [validateFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f && validateFile(f)) setFile(f);
    },
    [validateFile]
  );

  const validateMetadata = useCallback((): boolean => {
    const errors: string[] = [];
    if (!metadata.task_type) errors.push("Task type is required");
    if (metadata.price_per_use <= 0) errors.push("Price per use must be > 0");
    if (metadata.subscription_price <= 0)
      errors.push("Subscription price must be > 0");
    setMetaErrors(errors);
    return errors.length === 0;
  }, [metadata]);

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setUploadPhase(0);

    try {
      setUploadPhase(1);
      await new Promise((r) => setTimeout(r, 800));
      setUploadPhase(2);
      await new Promise((r) => setTimeout(r, 800));
      setUploadPhase(3);

      const result = await uploadAndEncryptModel(file, {
        task_type: metadata.task_type,
        framework_version: metadata.framework_version,
        accuracy_claim: metadata.accuracy_claim,
        price_per_use: metadata.price_per_use,
        subscription_price: metadata.subscription_price,
      });

      setUploadPhase(4);
      setCid(result.ipfs_cid);
      setKeyHash(result.encryption_key_hash);
      setKeyHex(result.encryption_key_hex);
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [file, metadata]);

  const handleCopy = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const handleRegister = useCallback(async () => {
    if (!publicKey || !cid || !keyHash) return;
    setRegistering(true);
    setRegisterError(null);
    try {
      const { tx, modelId } = await buildRegisterModelTx(publicKey, connection, {
        ipfs_cid: cid,
        encryption_key_hash: keyHash,
        task_type: metadata.task_type,
        framework_version: metadata.framework_version,
        accuracy_claim: metadata.accuracy_claim,
        price_per_use: metadata.price_per_use,
        subscription_price: metadata.subscription_price,
      });
      const sig = await sendTransaction(tx, connection);
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        { signature: sig, blockhash: latestBlockhash.blockhash, lastValidBlockHeight: latestBlockhash.lastValidBlockHeight },
        "confirmed"
      );
      setRegisterTxSig(sig);
      setRegisteredModelId(modelId);
      setRegistered(true);
    } catch (err: any) {
      setRegisterError(err.message || "Registration failed");
    } finally {
      setRegistering(false);
    }
  }, [publicKey, cid, keyHash, metadata, connection, sendTransaction]);

  const canProceed = useCallback(() => {
    if (currentStep === 0) return !!file && !fileError;
    if (currentStep === 1) return metaErrors.length === 0 && !!metadata.task_type && metadata.price_per_use > 0 && metadata.subscription_price > 0;
    if (currentStep === 2) return !!cid;
    return false;
  }, [currentStep, file, fileError, metadata, metaErrors, cid]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="min-h-screen bg-void font-mono relative bg-noise overflow-x-hidden">
      <div className="fixed inset-0 bg-dot-pattern opacity-100 pointer-events-none z-0" />
      <div className="relative z-50 pt-4">
        <FloatingHeader />
      </div>

      <main className="relative z-10 max-w-3xl mx-auto px-4 py-8 md:py-16">
        <GradientHeading variant="indigo" size="lg" className="mb-8 text-center">
          UPLOAD MODEL
        </GradientHeading>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-10 px-2">
          {STEPS.map((step, i) => {
            const StepIcon = step.icon;
            const active = i === currentStep;
            const completed = i < currentStep;
            return (
              <div key={step.label} className="flex flex-col items-center flex-1">
                <div
                  className={`flex items-center justify-center w-12 h-12 border-brutal ${
                    active
                      ? "bg-indigo text-void border-indigo shadow-brutal-sm"
                      : completed
                      ? "bg-emerald text-void border-emerald"
                      : "bg-card text-text-muted"
                  } transition-colors`}
                >
                  {completed ? (
                    <Check className="w-5 h-5" strokeWidth={3} />
                  ) : (
                    <StepIcon className="w-5 h-5" strokeWidth={2.5} />
                  )}
                </div>
                <span
                  className={`mt-2 text-[10px] font-heading font-black uppercase tracking-wider text-center ${
                    active ? "text-indigo" : completed ? "text-emerald" : "text-text-dim"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-card border-brutal mb-8">
          <div
            className="h-full bg-indigo transition-all duration-300"
            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <div className="bg-card border-brutal shadow-brutal-glow p-6 md:p-8 min-h-[400px]">
              {/* Step 1: Select File */}
              {currentStep === 0 && (
                <div className="flex flex-col items-center justify-center min-h-[320px]">
                  <h2 className="font-heading text-xl md:text-2xl font-black uppercase tracking-tight text-text-primary mb-6">
                    Select Model File
                  </h2>

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full max-w-md h-56 flex flex-col items-center justify-center border-4 border-dashed cursor-pointer transition-colors ${
                      dragOver
                        ? "border-indigo bg-indigo-dim"
                        : file
                        ? "border-emerald bg-emerald-dim"
                        : "border-border hover:border-indigo"
                    }`}
                  >
                    {file ? (
                      <>
                        <File className="w-12 h-12 text-emerald mb-3" strokeWidth={2.5} />
                        <p className="font-heading font-black uppercase text-emerald text-sm">
                          {file.name}
                        </p>
                        <p className="font-mono text-xs text-text-muted mt-1">
                          {formatSize(file.size)}
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload
                          className={`w-12 h-12 mb-3 ${
                            dragOver ? "text-indigo" : "text-text-muted"
                          }`}
                          strokeWidth={2.5}
                        />
                        <p className="font-heading font-black uppercase text-text-muted text-sm">
                          Drag & Drop or Click
                        </p>
                        <p className="font-mono text-xs text-text-dim mt-2">
                          .onnx, .pt, .h5, .pkl — Max 100MB
                        </p>
                      </>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_EXTENSIONS.join(",")}
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {fileError && (
                    <div className="mt-4 flex items-center gap-2 text-rose font-mono text-sm font-bold">
                      <AlertTriangle className="w-4 h-4" />
                      {fileError}
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Set Metadata */}
              {currentStep === 1 && (
                <div className="min-h-[320px]">
                  <h2 className="font-heading text-xl md:text-2xl font-black uppercase tracking-tight text-text-primary mb-6">
                    Model Metadata
                  </h2>

                  <div className="space-y-5">
                    <div>
                      <label className="block font-heading font-black uppercase text-xs text-text-muted mb-2 tracking-wider">
                        Task Type *
                      </label>
                      <select
                        value={metadata.task_type}
                        onChange={(e) =>
                          setMetadata((m) => ({ ...m, task_type: e.target.value }))
                        }
                        className="w-full h-12 border-brutal bg-surface px-4 font-mono font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-indigo/50 appearance-none cursor-pointer"
                      >
                        <option value="" disabled>
                          Select task type...
                        </option>
                        {TASK_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-heading font-black uppercase text-xs text-text-muted mb-2 tracking-wider">
                        Framework Version
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. pytorch 2.1.0"
                        value={metadata.framework_version}
                        onChange={(e) =>
                          setMetadata((m) => ({
                            ...m,
                            framework_version: e.target.value,
                          }))
                        }
                        className="w-full h-12 border-brutal bg-surface px-4 font-mono font-bold text-text-primary placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-indigo/50"
                      />
                    </div>

                    <div>
                      <label className="block font-heading font-black uppercase text-xs text-text-muted mb-2 tracking-wider">
                        Accuracy Claim — {metadata.accuracy_claim}%
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={metadata.accuracy_claim}
                        onChange={(e) =>
                          setMetadata((m) => ({
                            ...m,
                            accuracy_claim: Number(e.target.value),
                          }))
                        }
                        className="w-full h-3 accent-indigo cursor-pointer"
                      />
                      <div className="flex justify-between font-mono text-xs text-text-dim mt-1">
                        <span>0%</span>
                        <span>100%</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-heading font-black uppercase text-xs text-text-muted mb-2 tracking-wider">
                          Price Per Use (SOL) *
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min={0}
                          placeholder="0.01"
                          value={metadata.price_per_use || ""}
                          onChange={(e) =>
                            setMetadata((m) => ({
                              ...m,
                              price_per_use: Number(e.target.value),
                            }))
                          }
                          className="w-full h-12 border-brutal bg-surface px-4 font-mono font-bold text-text-primary placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-indigo/50"
                        />
                      </div>

                      <div>
                        <label className="block font-heading font-black uppercase text-xs text-text-muted mb-2 tracking-wider">
                          Subscription (SOL) *
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min={0}
                          placeholder="0.5"
                          value={metadata.subscription_price || ""}
                          onChange={(e) =>
                            setMetadata((m) => ({
                              ...m,
                              subscription_price: Number(e.target.value),
                            }))
                          }
                          className="w-full h-12 border-brutal bg-surface px-4 font-mono font-bold text-text-primary placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-indigo/50"
                        />
                      </div>
                    </div>
                  </div>

                  {metaErrors.length > 0 && (
                    <div className="mt-4 space-y-1">
                      {metaErrors.map((err) => (
                        <div
                          key={err}
                          className="flex items-center gap-2 text-rose font-mono text-sm font-bold"
                        >
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          {err}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Encrypt & Upload */}
              {currentStep === 2 && (
                <div className="flex flex-col items-center justify-center min-h-[320px]">
                  <h2 className="font-heading text-xl md:text-2xl font-black uppercase tracking-tight text-text-primary mb-8">
                    Encrypt & Upload
                  </h2>

                  {!cid && !uploadError && (
                    <div className="w-full max-w-sm space-y-4">
                      {[
                        "Generating AES-256-GCM key...",
                        "Encrypting model file...",
                        "Uploading to IPFS...",
                        "CID received!",
                      ].map((msg, i) => (
                        <div
                          key={msg}
                          className={`flex items-center gap-3 transition-all duration-300 ${
                            uploadPhase > i
                              ? "text-emerald"
                              : uploadPhase === i
                              ? "text-indigo animate-pulse"
                              : "text-text-dim"
                          }`}
                        >
                          <div
                            className={`w-6 h-6 border-2 flex items-center justify-center shrink-0 ${
                              uploadPhase > i
                                ? "border-emerald bg-emerald-dim"
                                : uploadPhase === i
                                ? "border-indigo bg-indigo-dim"
                                : "border-border"
                            }`}
                          >
                            {uploadPhase > i ? (
                              <Check className="w-3.5 h-3.5" strokeWidth={3} />
                            ) : uploadPhase === i ? (
                              <Lock className="w-3.5 h-3.5" strokeWidth={2.5} />
                            ) : (
                              <span className="w-1.5 h-1.5 bg-text-dim" />
                            )}
                          </div>
                          <span className="font-mono text-sm font-bold">{msg}</span>
                        </div>
                      ))}

                      {!uploading && uploadPhase === 0 && (
                        <Button
                          variant="emerald"
                          size="lg"
                          className="w-full mt-6"
                          onClick={handleUpload}
                        >
                          <Shield className="w-5 h-5 mr-2" strokeWidth={2.5} />
                          Begin Encryption & Upload
                        </Button>
                      )}

                      {uploading && (
                        <div className="mt-4 w-full h-2 bg-surface border-brutal overflow-hidden">
                          <div
                            className="h-full bg-indigo transition-all duration-500"
                            style={{
                              width: `${(uploadPhase / 3) * 100}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {uploadError && (
                    <div className="mt-4 p-4 border-brutal border-rose bg-rose-dim text-rose font-mono text-sm font-bold w-full max-w-sm">
                      <AlertTriangle className="w-5 h-5 inline mr-2 -mt-0.5" />
                      {uploadError}
                    </div>
                  )}

                  {cid && (
                    <div className="w-full max-w-lg space-y-4 mt-2">
                      <div className="p-4 border-brutal-accent bg-surface">
                        <span className="font-heading font-black uppercase text-xs text-text-muted tracking-wider">
                          IPFS CID
                        </span>
                        <p className="font-mono text-sm text-indigo font-bold mt-1 break-all">
                          {cid}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <button
                            onClick={() => handleCopy(cid, "cid")}
                            className="inline-flex items-center gap-1 text-xs text-violet font-mono font-bold hover:text-indigo transition-colors"
                          >
                            {copied === "cid" ? (
                              <Check className="w-3 h-3 text-emerald" strokeWidth={2.5} />
                            ) : (
                              <Copy className="w-3 h-3" strokeWidth={2.5} />
                            )}
                            {copied === "cid" ? "Copied!" : "Copy CID"}
                          </button>
                          <a
                            href={`https://gateway.pinata.cloud/ipfs/${cid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-violet font-mono font-bold hover:text-indigo transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Gateway Link
                          </a>
                        </div>
                        <p className="font-mono text-[10px] text-text-dim mt-1">
                          Encrypted file — gateway link will download binary, use CID to verify on IPFS
                        </p>
                      </div>

                      <div className="p-4 border-brutal bg-surface">
                        <span className="font-heading font-black uppercase text-xs text-text-muted tracking-wider">
                          Encryption Key Hash
                        </span>
                        <p className="font-mono text-xs text-text-primary font-bold mt-1 break-all">
                          {keyHash}
                        </p>
                      </div>

                      <div className="p-4 border-brutal border-amber/40 bg-amber-dim">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-amber" strokeWidth={2.5} />
                          <span className="font-heading font-black uppercase text-xs text-amber tracking-wider">
                            Save this key — it cannot be recovered
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <p className="font-mono text-xs text-text-primary font-bold break-all flex-1">
                            {keyHex}
                          </p>
                          <button
                            onClick={() => handleCopy(keyHex, "key")}
                            className="shrink-0 p-1.5 border-2 border-amber/40 hover:bg-amber hover:text-void transition-colors cursor-pointer"
                            title="Copy key"
                          >
                            {copied === "key" ? (
                              <Check className="w-4 h-4 text-emerald" strokeWidth={2.5} />
                            ) : (
                              <Copy className="w-4 h-4 text-amber" strokeWidth={2.5} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Register On-Chain */}
              {currentStep === 3 && (
                <div className="min-h-[320px]">
                  <h2 className="font-heading text-xl md:text-2xl font-black uppercase tracking-tight text-text-primary mb-6">
                    Register On-Chain
                  </h2>

                  {!registered ? (
                    <>
                      <div className="space-y-3 mb-6">
                        <div className="p-3 border-brutal bg-surface">
                          <span className="font-heading font-black uppercase text-[10px] text-text-dim tracking-wider">
                            File
                          </span>
                          <p className="font-mono text-sm text-text-primary font-bold mt-0.5">
                            {file?.name} — {file ? formatSize(file.size) : ""}
                          </p>
                        </div>

                        <div className="p-3 border-brutal bg-surface">
                          <span className="font-heading font-black uppercase text-[10px] text-text-dim tracking-wider">
                            Task / Framework
                          </span>
                          <p className="font-mono text-sm text-text-primary font-bold mt-0.5">
                            {metadata.task_type} / {metadata.framework_version || "—"}
                          </p>
                        </div>

                        <div className="p-3 border-brutal bg-surface">
                          <span className="font-heading font-black uppercase text-[10px] text-text-dim tracking-wider">
                            Accuracy / Pricing
                          </span>
                          <p className="font-mono text-sm text-text-primary font-bold mt-0.5">
                            {metadata.accuracy_claim}% &nbsp;·&nbsp;{" "}
                            {metadata.price_per_use} SOL/use &nbsp;·&nbsp;{" "}
                            {metadata.subscription_price} SOL/sub
                          </p>
                        </div>

                        <div className="p-3 border-brutal-accent bg-surface">
                          <span className="font-heading font-black uppercase text-[10px] text-text-dim tracking-wider">
                            CID
                          </span>
                          <p className="font-mono text-xs text-indigo font-bold mt-0.5 break-all">
                            {cid}
                          </p>
                        </div>

                        <div className="p-3 border-brutal bg-surface">
                          <span className="font-heading font-black uppercase text-[10px] text-text-dim tracking-wider">
                            Key Hash
                          </span>
                          <p className="font-mono text-xs text-text-primary font-bold mt-0.5 break-all">
                            {keyHash}
                          </p>
                        </div>
                      </div>

                      {!publicKey && (
                        <p className="text-rose font-mono text-xs font-bold mb-3">
                          Connect your wallet to register this model on-chain
                        </p>
                      )}

                      {registerError && (
                        <div className="mb-3 p-3 border-brutal border-rose bg-rose/10">
                          <p className="font-mono text-xs font-bold text-rose">
                            <AlertTriangle className="w-4 h-4 inline mr-1 -mt-0.5" />
                            {registerError}
                          </p>
                        </div>
                      )}

                      <Button
                        variant="default"
                        size="lg"
                        className="w-full"
                        onClick={handleRegister}
                        disabled={registering || !publicKey}
                      >
                        {registering ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Registering On-Chain...
                          </>
                        ) : (
                          <>
                            <Link2 className="w-5 h-5 mr-2" strokeWidth={2.5} />
                            Register Model On-Chain
                          </>
                        )}
                      </Button>

                      <p className="text-center font-mono text-xs text-text-dim mt-3">
                        Submits a Solana transaction to register your model with Token-2022 ownership NFT
                      </p>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <div className="w-16 h-16 border-brutal border-emerald bg-emerald-dim flex items-center justify-center mb-4">
                        <Check className="w-8 h-8 text-emerald" strokeWidth={3} />
                      </div>
                      <GradientHeading variant="emerald" size="md" className="mb-2">
                        Model Registered!
                      </GradientHeading>
                      <p className="font-mono text-sm text-text-muted mb-1">
                        On-Chain Model ID: <span className="text-indigo font-bold">{registeredModelId}</span>
                      </p>
                      {registerTxSig && (
                        <a
                          href={`https://explorer.solana.com/tx/${registerTxSig}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 font-mono text-xs font-bold text-indigo hover:text-violet transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" /> View Transaction on Explorer
                        </a>
                      )}
                      <a
                        href="/marketplace"
                        className="mt-4 inline-flex items-center gap-2 text-indigo font-mono font-bold text-sm hover:text-violet transition-colors"
                      >
                        View on Marketplace <ChevronRight className="w-4 h-4" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            size="default"
            onClick={goBack}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" strokeWidth={2.5} />
            Back
          </Button>

          {currentStep < 2 && (
            <Button
              variant="default"
              size="default"
              onClick={() => {
                if (currentStep === 1 && !validateMetadata()) return;
                goNext();
              }}
              disabled={!canProceed()}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" strokeWidth={2.5} />
            </Button>
          )}

          {currentStep === 2 && cid && (
            <Button variant="default" size="default" onClick={goNext}>
              Next
              <ChevronRight className="w-4 h-4 ml-1" strokeWidth={2.5} />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
