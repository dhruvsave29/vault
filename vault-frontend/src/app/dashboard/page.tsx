"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  useWallet,
  useConnection,
} from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Brain,
  DollarSign,
  Activity,
  ExternalLink,
  Eye,
} from "lucide-react";
import { FloatingHeader } from "@/components/ui/floating-header";
import { GradientHeading } from "@/components/ui/gradient-heading";
import { Button } from "@/components/ui/button";
import { fetchModels, type ModelInfo } from "@/lib/api/backend";

const MOCK_REVENUE = Array.from({ length: 7 }, (_, i) => ({
  day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
  sol: +(0.01 + Math.random() * 0.14).toFixed(3),
}));



interface InferenceEntry {
  model: string;
  inputHash: string;
  prediction: string;
  date: string;
  signature: string;
}

const MOCK_INFERENCES: InferenceEntry[] = [
  {
    model: "mnist-classifier-v1",
    inputHash: "0x3f8a…b2c1",
    prediction: "7",
    date: "2026-04-18 14:23",
    signature: "4Zk8fD2nJqL9xA1mWp7vBs3cR6eYhU0oTtKaNd5FgIwJmXbVrCuSo4Yq8EA2lj6PxB3wD7fG9nKs0RzVtMmWcA",
  },
  {
    model: "sentiment-v2",
    inputHash: "0xa9c1…7e4d",
    prediction: "Positive (0.92)",
    date: "2026-04-18 12:05",
    signature: "2Bn7gK4pRs9vF3qWmX5jLt8yC0eZbA1oDhUc6JiNsTfVrGxEa4wPpM3lS2oY7tQk9R8nW6dJ0gHuVfXcLb5mZ",
  },
  {
    model: "summarizer-lite",
    inputHash: "0x5d2e…f8a3",
    prediction: "Summary generated",
    date: "2026-04-17 22:11",
    signature: "7Hq3kM9pWs2vF5nXm8jLt6yC0eRbA4oDhUc1JiNsTfVrGxEa4wPpM3lS2oY7tQk9R8nW6dJ0gHuVfXcLb5mZa",
  },
  {
    model: "mnist-classifier-v1",
    inputHash: "0x1b7f…c9d2",
    prediction: "3",
    date: "2026-04-17 18:47",
    signature: "9Kt5mQ2rXw8vG4nYm7jPt3yC0eSbA6oDhUc1JiNsTfVrGxEa4wPpM3lS2oY7tQk9R8nW6dJ0gHuVfXcLb5mZd",
  },
];

export default function DashboardPage() {
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myModels = useMemo(() => {
    if (!publicKey) return [];
    const pk = publicKey.toBase58();
    return models.filter((m) => m.owner === pk);
  }, [models, publicKey]);

  const totalRevenue = useMemo(
    () => myModels.reduce((sum, m) => sum + (m.price_per_use * m.inference_count), 0),
    [myModels]
  );

  const totalInferences = useMemo(
    () => myModels.reduce((sum, m) => sum + (m.inference_count || 0), 0),
    [myModels]
  );

  useEffect(() => {
    if (!connected) return;
    let active = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await fetchModels();
        if (active) setModels(data);
      } catch (err: any) {
        if (active) setError(err.message || "Failed to fetch models");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [connected]);

  if (!connected) {
    return (
      <div className="min-h-screen bg-void font-mono relative bg-noise">
        <div className="fixed inset-0 bg-dot-pattern opacity-100 pointer-events-none z-0" />
        <div className="relative z-50 pt-4">
          <FloatingHeader />
        </div>
        <main className="relative z-10 flex flex-col items-center justify-center min-h-[60vh] px-4">
          <div className="bg-card border-brutal shadow-brutal-glow p-8 md:p-12 text-center max-w-md w-full">
            <Brain className="w-12 h-12 text-indigo mx-auto mb-4" strokeWidth={2.5} />
            <GradientHeading variant="indigo" size="md" className="mb-4">
              DASHBOARD
            </GradientHeading>
            <p className="font-mono text-sm text-text-muted mb-6">
              Connect your wallet to view your dashboard
            </p>
            <Button variant="default" size="lg" onClick={() => setVisible(true)}>
              Connect Wallet
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void font-mono relative bg-noise overflow-x-hidden">
      <div className="fixed inset-0 bg-dot-pattern opacity-100 pointer-events-none z-0" />
      <div className="relative z-50 pt-4">
        <FloatingHeader />
      </div>

      <main className="relative z-10 max-w-6xl mx-auto px-4 py-8 md:py-16">
        <GradientHeading variant="indigo" size="lg" className="mb-10">
          CREATOR DASHBOARD
        </GradientHeading>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card border-brutal shadow-brutal p-5">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-indigo" strokeWidth={2.5} />
              <span className="font-heading font-black uppercase text-[10px] text-text-muted tracking-wider">
                My Models
              </span>
            </div>
            <p className="font-heading text-3xl font-black text-indigo">
              {loading ? "..." : myModels.length}
            </p>
          </div>

          <div className="bg-card border-brutal shadow-brutal p-5">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-emerald" strokeWidth={2.5} />
              <span className="font-heading font-black uppercase text-[10px] text-text-muted tracking-wider">
                Total Inferences
              </span>
            </div>
            <p className="font-heading text-3xl font-black text-emerald">
              {loading ? "..." : totalInferences.toLocaleString()}
            </p>
          </div>

          <div className="bg-card border-brutal shadow-brutal p-5">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-amber" strokeWidth={2.5} />
              <span className="font-heading font-black uppercase text-[10px] text-text-muted tracking-wider">
                Total Revenue
              </span>
            </div>
            <p className="font-heading text-3xl font-black text-amber">
              {loading ? "..." : `${totalRevenue.toFixed(3)} SOL`}
            </p>
          </div>
        </div>

        {/* My Models */}
        <section className="mb-8">
          <h2 className="font-heading text-lg md:text-xl font-black uppercase tracking-tight text-text-primary mb-4 border-b-4 border-indigo/30 pb-2">
            My Models
          </h2>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-indigo border-t-transparent animate-spin" />
            </div>
          )}

          {error && (
            <div className="p-4 border-brutal border-rose bg-rose-dim text-rose font-mono text-sm font-bold">
              {error}
            </div>
          )}

          {!loading && !error && myModels.length === 0 && (
            <div className="bg-card border-brutal p-6 text-center">
              <p className="font-mono text-sm text-text-muted">
                No models found for your wallet. Upload your first model to get started.
              </p>
            </div>
          )}

          {!loading && myModels.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myModels.map((model) => (
                <div
                  key={model.model_id}
                  className="bg-card border-brutal shadow-brutal p-5 hover:bg-card-hover transition-colors"
                >
                  <h3 className="font-heading font-black uppercase text-sm text-text-primary mb-3 tracking-tight">
                    {model.name}
                  </h3>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="font-mono text-xs text-text-dim uppercase font-bold">
                        Inferences
                      </span>
                      <span className="font-mono text-xs text-emerald font-bold">
                        {model.inference_count?.toLocaleString() ?? 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-mono text-xs text-text-dim uppercase font-bold">
                        Revenue
                      </span>
                      <span className="font-mono text-xs text-amber font-bold">
                        {(model.price_per_use * model.inference_count).toFixed(3)} SOL
                      </span>
                    </div>
                  </div>
                  <a
                    href={`/models/${model.model_id}`}
                    className="mt-4 inline-flex items-center gap-1 text-xs font-mono font-bold text-indigo hover:text-violet transition-colors uppercase"
                  >
                    <Eye className="w-3 h-3" strokeWidth={2.5} />
                    View Details
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Revenue Overview */}
        <section className="mb-8">
          <h2 className="font-heading text-lg md:text-xl font-black uppercase tracking-tight text-text-primary mb-4 border-b-4 border-emerald/30 pb-2">
            Revenue Overview
          </h2>

          <div className="bg-card border-brutal shadow-brutal p-5">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={MOCK_REVENUE}
                  margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="indigoGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    stroke="rgba(255,255,255,0.15)"
                    tick={{ fill: "#64748b", fontSize: 11, fontFamily: "monospace" }}
                    tickLine={false}
                    axisLine={{ strokeWidth: 2 }}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.15)"
                    tick={{ fill: "#64748b", fontSize: 11, fontFamily: "monospace" }}
                    tickLine={false}
                    axisLine={{ strokeWidth: 2 }}
                    domain={[0, "auto"]}
                    tickFormatter={(v: number) => `${v.toFixed(2)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#151623",
                      border: "4px solid rgba(129,140,248,0.35)",
                      fontFamily: "monospace",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#e2e8f0",
                    }}
                    labelStyle={{ color: "#64748b", textTransform: "uppercase" }}
                    formatter={(value) => [`${value} SOL`, "Revenue"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="sol"
                    stroke="#818cf8"
                    strokeWidth={3}
                    fill="url(#indigoGradient)"
                    dot={{ r: 4, fill: "#818cf8", stroke: "#151623", strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: "#818cf8", stroke: "#151623", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center font-mono text-[10px] text-text-dim uppercase tracking-widest mt-2">
              Mock data — historical on-chain tracking coming soon
            </p>
          </div>
        </section>

        {/* Recent Inferences */}
        <section>
          <h2 className="font-heading text-lg md:text-xl font-black uppercase tracking-tight text-text-primary mb-4 border-b-4 border-violet/30 pb-2">
            Recent Inferences
          </h2>

          <div className="bg-card border-brutal shadow-brutal overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-brutal-b bg-surface">
                  <th className="px-4 py-3 text-left font-heading font-black uppercase text-[10px] text-text-muted tracking-wider">
                    Model
                  </th>
                  <th className="px-4 py-3 text-left font-heading font-black uppercase text-[10px] text-text-muted tracking-wider">
                    Input Hash
                  </th>
                  <th className="px-4 py-3 text-left font-heading font-black uppercase text-[10px] text-text-muted tracking-wider">
                    Prediction
                  </th>
                  <th className="px-4 py-3 text-left font-heading font-black uppercase text-[10px] text-text-muted tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left font-heading font-black uppercase text-[10px] text-text-muted tracking-wider">
                    Explorer
                  </th>
                </tr>
              </thead>
              <tbody>
                {MOCK_INFERENCES.map((inf, i) => (
                  <tr
                    key={i}
                    className="border-b-2 border-border/50 hover:bg-card-hover transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-sm text-indigo font-bold">
                      {inf.model}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text-muted font-bold">
                      {inf.inputHash}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-emerald font-bold">
                      {inf.prediction}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text-muted">
                      {inf.date}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`https://explorer.solana.com/tx/${inf.signature}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-mono font-bold text-violet hover:text-indigo transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" strokeWidth={2.5} />
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-center font-mono text-[10px] text-text-dim uppercase tracking-widest mt-2">
            Mock data — live inference tracking coming soon
          </p>
        </section>
      </main>
    </div>
  );
}
