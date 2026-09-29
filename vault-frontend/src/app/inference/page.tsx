"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Shield,
  Lock,
  X,
  ChevronDown,
  Eraser,
  Play,
  Loader2,
  ExternalLink,
  BarChart3,
} from "lucide-react";
import { FloatingHeader } from "@/components/ui/floating-header";
import { GradientHeading } from "@/components/ui/gradient-heading";
import { Button } from "@/components/ui/button";
import { fetchModels, runInference, type InferenceResult, type ModelInfo } from "@/lib/api/backend";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { cn } from "@/lib/utils";

function PaymentModal({
  open,
  amount,
  modelName,
  onPay,
  onClose,
  paying,
}: {
  open: boolean;
  amount: number;
  modelName: string;
  onPay: () => void;
  onClose: () => void;
  paying: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-void/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border-brutal-accent shadow-brutal-glow glow-indigo p-8 max-w-md w-full mx-4"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-heading text-xl font-black uppercase tracking-tight text-text-primary">
                Payment Required
              </h3>
              <button
                onClick={onClose}
                className="text-text-muted hover:text-rose transition-colors p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-surface border-brutal p-4">
                <p className="font-mono text-sm text-text-muted mb-1">Model</p>
                <p className="font-heading text-lg font-black uppercase text-text-primary">
                  {modelName}
                </p>
              </div>
              <div className="bg-surface border-brutal p-4">
                <p className="font-mono text-sm text-text-muted mb-1">Amount</p>
                <p className="font-heading text-2xl font-black text-emerald">
                  {amount} SOL
                </p>
              </div>
              <Button
                variant="default"
                size="lg"
                className="w-full"
                onClick={onPay}
                disabled={paying}
              >
                {paying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" strokeWidth={3} /> Pay & Run Inference
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ConfidenceBars({ probabilities }: { probabilities: number[] }) {
  const max = Math.max(...probabilities, 0.001);
  return (
    <div className="space-y-1">
      {probabilities.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-text-muted w-4 text-right">
            {i}
          </span>
          <div className="flex-1 h-5 bg-surface border-2 border-border relative overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(p / max) * 100}%` }}
              transition={{ duration: 0.5, delay: i * 0.03 }}
              className={cn(
                "h-full",
                p === max ? "bg-indigo" : "bg-indigo-dim"
              )}
            />
          </div>
          <span className="font-mono text-xs font-bold text-text-muted w-14 text-right tabular-nums">
            {(p * 100).toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function InferencePageInner() {
  const searchParams = useSearchParams();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [modelsLoading, setModelsLoading] = useState(true);
  const [textInput, setTextInput] = useState("");
  const [result, setResult] = useState<InferenceResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentModelName, setPaymentModelName] = useState("");
  const [paying, setPaying] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const selectedModel = useMemo(
    () => models.find((m) => String(m.model_id) === selectedModelId),
    [models, selectedModelId]
  );

  const isCanvasModel = useMemo(() => {
    const tt = selectedModel?.task_type ?? "";
    return tt === "classification" || tt === "mnist";
  }, [selectedModel]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await fetchModels();
        if (active) {
          setModels(Array.isArray(data) ? data : []);
          const preselect = searchParams.get("model");
          if (preselect && data.some((m) => String(m.model_id) === preselect)) {
            setSelectedModelId(preselect);
          } else if (data.length > 0) {
            setSelectedModelId(String(data[0].model_id));
          }
        }
      } catch {
      } finally {
        if (active) setModelsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [searchParams]);

  const getCanvasCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      if ("touches" in e) {
        const t = e.touches[0];
        return {
          x: (t.clientX - rect.left) * scaleX,
          y: (t.clientY - rect.top) * scaleY,
        };
      }
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    []
  );

  const startDrawing = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      isDrawingRef.current = true;
      lastPosRef.current = getCanvasCoords(e);
    },
    [getCanvasCoords]
  );

  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (!isDrawingRef.current || !lastPosRef.current) return;
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      const pos = getCanvasCoords(e);
      ctx.strokeStyle = "white";
      ctx.lineWidth = 16;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastPosRef.current = pos;
    },
    [getCanvasCoords]
  );

  const stopDrawing = useCallback(() => {
    isDrawingRef.current = false;
    lastPosRef.current = null;
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    clearCanvas();
  }, [clearCanvas]);

  const canvasToInputData = useCallback((): number[] => {
    const canvas = canvasRef.current!;
    const tmp = document.createElement("canvas");
    tmp.width = 28;
    tmp.height = 28;
    const ctx = tmp.getContext("2d")!;
    ctx.drawImage(canvas, 0, 0, 28, 28);
    const imgData = ctx.getImageData(0, 0, 28, 28);
    const data: number[] = [];
    for (let i = 0; i < imgData.data.length; i += 4) {
      const gray = imgData.data[i];
      data.push(gray / 255);
    }
    return data;
  }, []);

  const handleRunInference = useCallback(async () => {
    if (!selectedModelId || !publicKey) {
      setError("Select a model and connect your wallet first.");
      return;
    }
    setError(null);
    setResult(null);
    setRunning(true);

    try {
      const inputData = isCanvasModel ? canvasToInputData() : [];
      const inputText = !isCanvasModel ? textInput : undefined;

      const payload = isCanvasModel
        ? inputData
        : Array.from({ length: 10 }).map(() => 0);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"}/v1/inference/${selectedModelId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input_data: payload,
            input_text: inputText,
          }),
        }
      );

      if (res.status === 402) {
        const payInfo = await res.json();
        setPaymentAmount(payInfo.amount);
        setPaymentModelName(payInfo.model_name ?? selectedModelId);
        setPaymentOpen(true);
        setRunning(false);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setResult(data);
        return;
      }

      throw new Error(`Inference failed: ${res.statusText}`);
    } catch (e: any) {
      setError(e.message ?? "Inference failed");
    } finally {
      setRunning(false);
    }
  }, [selectedModelId, publicKey, isCanvasModel, canvasToInputData, textInput]);

  const handlePayment = useCallback(async () => {
    if (!publicKey) return;
    setPaying(true);
    try {
      const inputData = isCanvasModel ? canvasToInputData() : Array.from({ length: 10 }).map(() => 0);
      const inputText = !isCanvasModel ? textInput : undefined;

      const result = await runInference(
        selectedModelId,
        inputData,
        publicKey,
        (tx) => sendTransaction(tx, connection),
        connection,
        inputText
      );
      setResult(result);
      setPaymentOpen(false);
    } catch (e: any) {
      setError(e.message ?? "Payment or inference failed");
    } finally {
      setPaying(false);
    }
  }, [publicKey, selectedModelId, isCanvasModel, canvasToInputData, textInput, sendTransaction, connection]);

  return (
    <div className="min-h-screen bg-void font-mono relative bg-noise overflow-x-hidden">
      <div className="fixed inset-0 bg-dot-pattern opacity-100 pointer-events-none z-0" />
      <div className="relative z-50 pt-4">
        <FloatingHeader />
      </div>
      <main className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 py-8 mt-6">
        <GradientHeading variant="indigo" size="lg" className="mb-6">
          RUN INFERENCE
        </GradientHeading>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-card border-brutal shadow-brutal p-5">
              <label className="font-heading text-xs font-black uppercase tracking-wider text-text-muted mb-2 block">
                Select Model
              </label>
              <div className="relative">
                <select
                  value={selectedModelId}
                  onChange={(e) => setSelectedModelId(e.target.value)}
                  disabled={modelsLoading}
                  className="w-full appearance-none bg-surface border-brutal px-4 py-3 font-mono text-sm font-bold text-text-primary focus:outline-none focus:border-indigo cursor-pointer disabled:opacity-50"
                >
                  {modelsLoading ? (
                    <option>Loading models...</option>
                  ) : models.length === 0 ? (
                    <option>No models available</option>
                  ) : (
                    models.map((m) => (
                      <option key={m.model_id} value={m.model_id}>
                        {m.name} — {(m.accuracy * 100).toFixed(1)}%
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
              </div>
            </div>

            {isCanvasModel ? (
              <div className="bg-card border-brutal shadow-brutal p-5 space-y-3">
                <label className="font-heading text-xs font-black uppercase tracking-wider text-text-muted block">
                  Draw Input (280x280)
                </label>
                <div className="border-brutal bg-black inline-block">
                  <canvas
                    ref={canvasRef}
                    width={280}
                    height={280}
                    className="cursor-crosshair touch-none block w-[280px] h-[280px]"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={clearCanvas}>
                    <Eraser className="w-4 h-4 mr-1" /> Clear
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleRunInference}
                    disabled={running || !publicKey}
                  >
                    {running ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 mr-1" strokeWidth={3} />
                    )}
                    Run Inference
                  </Button>
                </div>
                {!publicKey && (
                  <p className="text-rose font-mono text-xs font-bold">
                    Connect wallet to run inference
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-card border-brutal shadow-brutal p-5 space-y-3">
                <label className="font-heading text-xs font-black uppercase tracking-wider text-text-muted block">
                  Input Text
                </label>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  rows={6}
                  placeholder="Enter text for analysis..."
                  className="w-full bg-surface border-brutal px-4 py-3 font-mono text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-indigo resize-none"
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleRunInference}
                  disabled={running || !publicKey}
                >
                  {running ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-1" strokeWidth={3} />
                  )}
                  Run Inference
                </Button>
                {!publicKey && (
                  <p className="text-rose font-mono text-xs font-bold">
                    Connect wallet to run inference
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border-brutal-accent border-rose p-4"
              >
                <p className="font-mono text-sm font-bold text-rose">{error}</p>
              </motion.div>
            )}

            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="bg-card border-brutal shadow-brutal p-5">
                  <h3 className="font-heading text-sm font-black uppercase tracking-wider text-text-muted mb-3">
                    Result
                  </h3>
                  <div className="bg-surface border-brutal p-4 mb-4">
                    <p className="font-mono text-sm text-text-muted mb-1">Prediction</p>
                    <p className="font-heading text-3xl font-black text-emerald uppercase">
                      {String(result.prediction)}
                    </p>
                    <p className="font-mono text-sm text-text-muted mt-1">
                      Confidence: {(result.confidence * 100).toFixed(1)}%
                    </p>
                  </div>

                  {result.probabilities && result.probabilities.length === 10 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="w-4 h-4 text-indigo" strokeWidth={3} />
                        <span className="font-heading text-xs font-black uppercase tracking-wider text-text-muted">
                          Confidence Distribution
                        </span>
                      </div>
                      <ConfidenceBars probabilities={result.probabilities} />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-surface border-2 border-border p-3">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
                        Inference Time
                      </p>
                      <p className="font-heading text-lg font-black text-text-primary tabular-nums">
                        {result.metrics.inference_time_ms}ms
                      </p>
                    </div>
                    <div className="bg-surface border-2 border-border p-3">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
                        Input Tokens
                      </p>
                      <p className="font-heading text-lg font-black text-text-primary tabular-nums">
                        {result.metrics.input_tokens}
                      </p>
                    </div>
                    <div className="bg-surface border-2 border-border p-3">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
                        Memory Peak
                      </p>
                      <p className="font-heading text-lg font-black text-text-primary tabular-nums">
                        {result.metrics.memory_peak_kb}KB
                      </p>
                    </div>
                    <div className="bg-surface border-2 border-border p-3">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
                        TEE Attestation
                      </p>
                      <p className="font-mono text-[10px] font-bold text-indigo truncate">
                        {result.attestation.tee_attestation_hash.slice(0, 16)}...
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <Link
                      href={`https://explorer.solana.com/tx/${result.payment.signature}?cluster=devnet`}
                      target="_blank"
                      className="inline-flex items-center gap-1 font-mono text-xs font-bold text-indigo hover:text-violet transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> View on Explorer
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </main>

      <PaymentModal
        open={paymentOpen}
        amount={paymentAmount}
        modelName={paymentModelName}
        onPay={handlePayment}
        onClose={() => setPaymentOpen(false)}
        paying={paying}
      />
    </div>
  );
}

export default function InferencePage() {
  return (
    <Suspense>
      <InferencePageInner />
    </Suspense>
  );
}
