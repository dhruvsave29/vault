import { PublicKey } from "@solana/web3.js";
import IDL from "./idl/vault.json";

const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!);

function numberToLeBytes(n: number): Uint8Array {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  const lo = n & 0xffffffff;
  const hi = Math.floor(n / 0x100000000) & 0xffffffff;
  view.setUint32(0, lo, true);
  view.setUint32(4, hi, true);
  return new Uint8Array(buf);
}

export function getModelPda(modelId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("model"), numberToLeBytes(modelId)],
    PROGRAM_ID
  );
}

export function getGlobalStatePda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("global")],
    PROGRAM_ID
  );
}

export function getReputationPda(modelPda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("reputation"), modelPda.toBuffer()],
    PROGRAM_ID
  );
}

export function getEscrowPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("escrow")],
    PROGRAM_ID
  );
}

export function getNodePda(address: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("node"), address.toBuffer()],
    PROGRAM_ID
  );
}

export { PROGRAM_ID, IDL };
