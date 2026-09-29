import { ArrowRight, Shield, Lock, Cloud, BarChart3, Users, Zap } from "lucide-react";
import Link from "next/link";
import HeroText from "@/components/ui/hero-shutter-text";
import { MetricsScoreCards } from "@/components/ui/metrics-score-cards";
import { GradientHeading } from "@/components/ui/gradient-heading";
import { FloatingHeader } from "@/components/ui/floating-header";
import { GridAnimation } from "@/components/ui/mouse-following-line";

export default function Home() {
  const featuresData = [
    {
      title: "Encrypted Storage",
      description: "AES-256-GCM encryption in your browser before upload. Only TEE-authorized nodes can decrypt. Your model weights never exist in plaintext on any server.",
      initialScore: 96,
      icon: <Lock className="w-8 h-8 stroke-indigo" strokeWidth={3} />,
      color: "#818cf8",
    },
    {
      title: "On-Chain Revenue",
      description: "Smart-contract enforced 70/25/5 split. Contributors earn by verified share. Compute nodes earn per inference. Zero intermediaries, zero hidden fees.",
      initialScore: 88,
      icon: <BarChart3 className="w-8 h-8 stroke-emerald" strokeWidth={3} />,
      color: "#34d399",
    },
    {
      title: "Verified Inference",
      description: "TEE-attested metrics on every inference. ZK accuracy proofs. Every prediction comes with a cryptographic guarantee of correct computation.",
      initialScore: 72,
      icon: <Shield className="w-8 h-8 stroke-violet" strokeWidth={3} />,
      color: "#a78bfa",
    },
  ];

  return (
    <div className="min-h-screen bg-void font-mono relative bg-noise overflow-x-hidden">
      <div className="fixed inset-0 bg-dot-pattern opacity-100 pointer-events-none z-0" />

      <div className="relative z-50 pt-4">
        <FloatingHeader />
      </div>

      <main className="flex flex-col relative z-10">
        {/* Hero Section */}
        <section className="relative px-6 py-12 md:px-12 md:py-20 border-brutal-b bg-transparent overflow-hidden mt-6">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 relative z-10">
            <div className="absolute top-[-50px] right-[-100px] w-96 h-96 bg-indigo rounded-full blur-3xl opacity-10 pointer-events-none" />

            <div className="flex flex-col justify-center z-10 w-full overflow-hidden">
              <div className="mb-0 w-fit relative mt-8 md:mt-0">
                <HeroText text="VAULT" className="items-start" />
              </div>

              <GradientHeading
                variant="indigo"
                size="md"
                weight="black"
                className="mb-8 font-heading mt-2"
              >
                DECENTRALIZED AI MARKETPLACE
              </GradientHeading>

              <p className="font-mono text-lg md:text-xl max-w-xl mb-10 leading-snug font-semibold text-text-primary bg-surface/60 backdrop-blur-sm p-4 border-l-4 border-indigo">
                Publish, discover, and run ML models with cryptographic proofs. No intermediaries. Full transparency. Encrypted by default.
              </p>

              <div className="flex flex-wrap gap-4">
                <Link
                  href="/marketplace"
                  className="inline-flex w-max items-center justify-center gap-3 bg-indigo brutal-btn px-8 py-5 text-xl md:text-2xl uppercase whitespace-nowrap text-void border-indigo"
                >
                  Explore Models <ArrowRight className="w-6 h-6 md:w-7 md:h-7" strokeWidth={3} />
                </Link>
                <Link
                  href="/upload"
                  className="inline-flex w-max items-center justify-center gap-3 bg-surface brutal-btn px-8 py-5 text-xl md:text-2xl uppercase whitespace-nowrap text-text-primary border-border hover:bg-violet hover:text-void hover:border-violet"
                >
                  Upload Model
                </Link>
              </div>
            </div>

            <div className="relative z-10 flex items-center justify-center lg:justify-end mt-16 lg:mt-0">
              <div className="relative w-full min-w-[320px] max-w-[800px] h-auto scale-110 lg:scale-125 lg:translate-x-4 lg:translate-y-8">
                <div className="w-full bg-surface border-brutal shadow-brutal flex items-center justify-center overflow-hidden rotate-2 hover:rotate-0 transition-transform duration-300">
                  <img
                    src="/hero-diagram.png"
                    alt="VAULT Architecture Diagram"
                    className="w-full h-auto object-contain scale-[1.02] opacity-80"
                  />
                </div>

                <div className="absolute -bottom-10 -left-6 md:-bottom-12 md:-left-16 w-[80%] max-w-[350px] bg-card border-brutal-accent shadow-brutal-glow p-4 md:p-6 animate-pulse -rotate-3 hover:rotate-0 transition-transform duration-300 z-20">
                  <div className="flex items-center gap-3 mb-2 md:mb-3 border-b-4 border-indigo/30 pb-2">
                    <div className="relative w-3 h-3 md:w-4 md:h-4 shrink-0">
                      <span className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-emerald border-[1.5px] md:border-2 border-indigo animate-ping absolute inset-0" />
                      <span className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-emerald border-[1.5px] md:border-2 border-indigo absolute inset-0" />
                    </div>
                    <span className="font-heading font-black uppercase text-base md:text-xl tracking-tight leading-none text-text-primary">Inference Complete</span>
                  </div>
                  <p className="font-mono text-[10px] md:text-sm leading-snug font-bold text-text-muted">
                    Prediction: <span className="text-emerald font-black px-1 border-2 border-emerald/40">7</span> with 98.1% confidence. TEE-attested. On-chain proof verified.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="px-6 py-20 md:px-12 md:py-28 bg-surface text-text-primary border-brutal-b relative bg-grid-pattern-dark">
          <div className="max-w-4xl mx-auto">
            <GradientHeading
              variant="indigo"
              size="xl"
              className="text-center mb-16"
            >
              THE TRUST PROTOCOL
            </GradientHeading>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-16">
              <div>
                <h3 className="font-heading text-3xl font-black text-indigo mb-4 border-b-4 border-indigo/30 pb-2 uppercase tracking-tight">01. Encrypt & Upload</h3>
                <p className="font-mono text-lg text-text-muted">
                  Your model is encrypted with AES-256-GCM right in the browser. The key never touches any server. The encrypted file goes to IPFS. Only the CID hash lives on-chain.
                </p>
              </div>
              <div>
                <h3 className="font-heading text-3xl font-black text-violet mb-4 border-b-4 border-violet/30 pb-2 uppercase tracking-tight">02. Verify & Trust</h3>
                <p className="font-mono text-lg text-text-muted">
                  ZK proofs verify model accuracy. TEE attestation guarantees honest computation. Every inference is backed by cryptographic proof — not reputation, not promises.
                </p>
              </div>
              <div>
                <h3 className="font-heading text-3xl font-black text-emerald mb-4 border-b-4 border-emerald/30 pb-2 uppercase tracking-tight">03. Discover & Run</h3>
                <p className="font-mono text-lg text-text-muted">
                  Browse models by task, accuracy, and price. Pay per inference via the x402 protocol. VRF selects the compute node fairly. No favoritism, no censorship.
                </p>
              </div>
              <div>
                <h3 className="font-heading text-3xl font-black text-amber mb-4 border-b-4 border-amber/30 pb-2 uppercase tracking-tight">04. Earn & Govern</h3>
                <p className="font-mono text-lg text-text-muted">
                  70% to contributors, 25% to compute nodes, 5% to protocol — enforced by smart contract. Own your model via SPL Token-2022. Transfer, sell, subscribe.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features / Metrics */}
        <section id="features" className="px-6 py-20 md:px-12 md:py-32 bg-transparent border-brutal-b relative">
          <div className="text-center mb-20 relative z-10">
            <GradientHeading
              variant="emerald"
              size="xl"
              className="mb-4"
            >
              CRYPTOGRAPHIC GUARANTEES
            </GradientHeading>
            <p className="font-mono text-xl text-center max-w-2xl mx-auto font-bold text-text-muted">
              Three pillars that make VAULT the first marketplace where trust is mathematical, not social.
            </p>
          </div>

          <MetricsScoreCards data={featuresData} />
        </section>

        {/* Badges Row */}
        <section className="px-6 py-16 md:px-12 bg-surface border-brutal-b">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { icon: Shield, label: "ZK Verified", color: "text-emerald", border: "border-emerald/30", glow: "glow-emerald" },
                { icon: Lock, label: "TEE Protected", color: "text-indigo", border: "border-indigo/30", glow: "glow-indigo" },
                { icon: Cloud, label: "IPFS Stored", color: "text-violet", border: "border-violet/30", glow: "glow-violet" },
                { icon: BarChart3, label: "On-Chain Revenue", color: "text-amber", border: "border-amber/30", glow: "" },
                { icon: Users, label: "Multi-Owner", color: "text-indigo", border: "border-indigo/30", glow: "glow-indigo" },
                { icon: Zap, label: "Zero-Fee L2", color: "text-emerald", border: "border-emerald/30", glow: "glow-emerald" },
              ].map((badge) => (
                <div
                  key={badge.label}
                  className={`flex flex-col items-center gap-3 p-4 md:p-6 border-brutal bg-card hover:bg-card-hover transition-all duration-200 hover:-translate-y-1 ${badge.glow}`}
                >
                  <badge.icon className={`w-8 h-8 ${badge.color} stroke-[2.5px]`} />
                  <span className="font-heading font-black text-sm md:text-base uppercase tracking-tight text-text-primary text-center">
                    {badge.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="cta" className="px-6 py-24 md:px-12 md:py-32 bg-indigo-dim border-brutal-b border-t-4 border-indigo/20 flex flex-col items-center justify-center text-center relative overflow-hidden mt-0">
          <GridAnimation
            cols={50}
            rows={20}
            spacing={40}
            strokeLength={18}
            strokeWidth={3}
            lineColor="rgba(129,140,248,0.08)"
            className="absolute inset-0 w-full h-full"
          />

          <div className="relative z-10 flex flex-col items-center">
            <GradientHeading
              variant="indigo"
              size="xxl"
              className="mb-8 max-w-4xl"
            >
              RUN YOUR FIRST INFERENCE.
            </GradientHeading>
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-4 bg-void text-indigo brutal-btn hover:bg-indigo hover:text-void border-indigo px-10 py-6 text-2xl md:text-4xl uppercase"
            >
              Open Marketplace <ArrowRight className="w-10 h-10" strokeWidth={3} />
            </Link>
          </div>
        </section>

        {/* Footer */}
        <div className="bg-transparent px-4 py-8 pb-12 w-full flex justify-center mt-8">
          <footer className="w-full max-w-7xl bg-surface text-text-primary border-brutal shadow-brutal p-8 md:p-12 flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden bg-grid-pattern-dark">
            <div className="flex flex-col md:flex-row items-center gap-6 md:gap-12 z-10">
              <div className="flex items-center gap-3">
                <Shield className="size-8 stroke-[3px] text-indigo" />
                <div className="font-heading text-3xl font-black uppercase tracking-tighter text-text-primary">VAULT</div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-6 font-mono text-sm font-bold uppercase tracking-widest text-text-muted">
                <a href="#features" className="hover:text-indigo transition-colors">Features</a>
                <a href="#how-it-works" className="hover:text-violet transition-colors">How It Works</a>
                <a href="/marketplace" className="hover:text-emerald transition-colors">Marketplace</a>
                <a href="/upload" className="hover:text-amber transition-colors">Upload</a>
              </div>
            </div>

            <div className="flex flex-col items-center md:items-end gap-2 z-10">
              <div className="text-xs font-mono font-bold uppercase tracking-widest text-text-dim">Built On</div>
              <div className="flex gap-2">
                <span className="bg-indigo-dim px-3 py-1 text-xs font-mono font-bold uppercase border border-indigo/20 text-indigo">Solana</span>
                <span className="bg-violet-dim px-3 py-1 text-xs font-mono font-bold uppercase border border-violet/20 text-violet">MagicBlock</span>
                <span className="bg-emerald-dim px-3 py-1 text-xs font-mono font-bold uppercase border border-emerald/20 text-emerald">IPFS</span>
              </div>
            </div>

            <div className="absolute bottom-4 left-0 right-0 text-center text-[10px] font-mono font-bold uppercase tracking-widest text-text-dim z-10">
              Copyright &copy; {new Date().getFullYear()} VAULT Protocol. All rights reserved.
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
