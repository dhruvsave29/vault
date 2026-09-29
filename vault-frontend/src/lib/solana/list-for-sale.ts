import {
  PublicKey,
  TransactionInstruction,
  Transaction,
  Connection,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { PROGRAM_ID, getModelPda } from "./program";

const LIST_FOR_SALE_DISCRIMINATOR = new Uint8Array([188, 214, 1, 112, 93, 215, 124, 207]);

function writeU64LE(view: DataView, offset: number, value: number): void {
  const lo = value & 0xffffffff;
  const hi = Math.floor(value / 0x100000000) & 0xffffffff;
  view.setUint32(offset, lo, true);
  view.setUint32(offset + 4, hi, true);
}

export async function buildListForSaleTx(
  authority: PublicKey,
  modelId: number,
  priceSol: number,
  connection: Connection
): Promise<Transaction> {
  const [modelPda] = getModelPda(modelId);
  const priceLamports = Math.round(priceSol * LAMPORTS_PER_SOL);

  const argsBuf = new ArrayBuffer(8);
  const argsView = new DataView(argsBuf);
  writeU64LE(argsView, 0, priceLamports);

  const instructionData = new Uint8Array(LIST_FOR_SALE_DISCRIMINATOR.length + 8);
  instructionData.set(LIST_FOR_SALE_DISCRIMINATOR, 0);
  instructionData.set(new Uint8Array(argsBuf), LIST_FOR_SALE_DISCRIMINATOR.length);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: modelPda, isSigner: false, isWritable: true },
    ],
    data: instructionData as any,
  });

  return new Transaction().add(ix);
}
