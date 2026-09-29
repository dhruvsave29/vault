"use client";

import React from "react";
import { ShieldIcon, MenuIcon } from "lucide-react";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

export function FloatingHeader() {
  const [open, setOpen] = React.useState(false);
  const [balance, setBalance] = React.useState<number | null>(null);
  const { setVisible } = useWalletModal();
  const { publicKey, connected, disconnect } = useWallet();
  const { connection } = useConnection();

  React.useEffect(() => {
    if (!publicKey) {
      setBalance(null);
      return;
    }
    let active = true;
    (async () => {
      try {
        const bal = await connection.getBalance(publicKey);
        if (active) setBalance(bal / LAMPORTS_PER_SOL);
      } catch {}
    })();
    const id = setInterval(async () => {
      try {
        const bal = await connection.getBalance(publicKey);
        if (active) setBalance(bal / LAMPORTS_PER_SOL);
      } catch {}
    }, 15000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [publicKey, connection]);

  const truncate = (pk: PublicKey) =>
    `${pk.toBase58().slice(0, 4)}...${pk.toBase58().slice(-4)}`;

  const navLinks = [
    { label: "Marketplace", href: "/marketplace" },
    { label: "Upload", href: "/upload" },
    { label: "Dashboard", href: "/dashboard" },
  ];

  return (
    <header
      className={cn(
        "sticky top-6 z-50",
        "mx-auto w-[95%] max-w-7xl border-brutal shadow-brutal",
        "bg-surface/90 backdrop-blur-sm transition-all duration-300"
      )}
    >
      <nav className="mx-auto flex items-center justify-between p-4 px-6 md:px-8">
        <Link
          href="/"
          className="hover:bg-indigo-dim flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors border-2 border-transparent hover:border-indigo/40"
        >
          <ShieldIcon className="size-8 stroke-[3px] text-indigo" />
          <p className="font-heading text-2xl md:text-3xl font-black uppercase tracking-tighter text-text-primary">
            VAULT
          </p>
        </Link>

        <div className="hidden items-center gap-4 lg:flex px-4">
          {navLinks.map((link) => (
            <a
              key={link.label}
              className={buttonVariants({
                variant: "ghost",
                size: "lg",
                className:
                  "text-base hover:text-indigo",
              })}
              href={link.href}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {connected && publicKey ? (
            <div className="hidden md:flex items-center gap-3">
              <div className="px-3 py-1.5 border-brutal bg-card text-emerald font-mono text-sm font-bold">
                {balance !== null ? `${balance.toFixed(3)} SOL` : "..."}
              </div>
              <button
                onClick={() => disconnect()}
                className="px-3 py-1.5 border-brutal bg-card text-text-muted font-mono text-sm font-bold hover:text-rose hover:border-rose/40 transition-colors cursor-pointer"
              >
                {truncate(publicKey)}
              </button>
            </div>
          ) : (
            <Button
              size="lg"
              variant="default"
              className="hidden lg:flex"
              onClick={() => setVisible(true)}
            >
              Connect Wallet
            </Button>
          )}

          <Sheet open={open} onOpenChange={setOpen}>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setOpen(!open)}
              className="lg:hidden h-10 w-10"
            >
              <MenuIcon className="size-5" />
            </Button>
            <SheetContent
              side="left"
              className="p-0 gap-0 border-r-4 border-border w-full sm:w-80 bg-surface"
              showClose={false}
            >
              <SheetHeader className="flex flex-row items-center justify-between bg-card">
                <SheetTitle className="text-text-primary">VAULT</SheetTitle>
                <SheetClose className="border-brutal p-1 text-text-muted hover:bg-indigo hover:text-void transition-colors">
                  <MenuIcon className="size-5" />
                </SheetClose>
              </SheetHeader>
              <div className="grid gap-y-2 overflow-y-auto px-6 py-10 flex-grow">
                {navLinks.map((link) => (
                  <a
                    key={link.label}
                    className={buttonVariants({
                      variant: "ghost",
                      className:
                        "justify-start text-xl border-b border-border hover:border-indigo/40 hover:bg-transparent rounded-none text-text-primary",
                    })}
                    href={link.href}
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
              <SheetFooter className="gap-4 bg-card">
                {connected && publicKey ? (
                  <div className="w-full space-y-2">
                    <div className="px-3 py-2 border-brutal bg-surface text-emerald font-mono text-sm font-bold text-center">
                      {balance !== null ? `${balance.toFixed(3)} SOL` : "..."}
                    </div>
                    <Button
                      variant="destructive"
                      className="w-full"
                      size="lg"
                      onClick={() => {
                        disconnect();
                        setOpen(false);
                      }}
                    >
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => {
                      setVisible(true);
                      setOpen(false);
                    }}
                  >
                    Connect Wallet
                  </Button>
                )}
              </SheetFooter>
            </SheetContent>
          </Sheet>

          {!connected && (
            <Button
              size="sm"
              variant="default"
              className="lg:hidden"
              onClick={() => setVisible(true)}
            >
              Connect
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
}
