import {
  PublicKey,
  TransactionInstruction,
  Transaction,
  SystemProgram,
  Connection,
} from "@solana/web3.js";
import { PROGRAM_ID, getModelPda } from "./program";

const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

const BUY_MODEL_DISCRIMINATOR = new Uint8Array([91, 242, 103, 37, 140, 5, 67, 77]);

function numberToLeBytes(n: number): Uint8Array {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  const lo = n & 0xffffffff;
  const hi = Math.floor(n / 0x100000000) & 0xffffffff;
  view.setUint32(0, lo, true);
  view.setUint32(4, hi, true);
  return new Uint8Array(buf);
}

function getOwnershipMintPda(modelId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("ownership_mint"), numberToLeBytes(modelId)],
    PROGRAM_ID
  );
}

function getAssociatedTokenAddress(
  wallet: PublicKey,
  mint: PublicKey,
  tokenProgram: PublicKey
): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [wallet.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return ata;
}

export async function buildBuyModelTx(
  buyer: PublicKey,
  currentOwner: PublicKey,
  modelId: number,
  connection: Connection
): Promise<Transaction> {
  const [modelPda] = getModelPda(modelId);
  const [ownershipMintPda] = getOwnershipMintPda(modelId);
  const ownerAta = getAssociatedTokenAddress(currentOwner, ownershipMintPda, TOKEN_2022_PROGRAM_ID);
  const buyerAta = getAssociatedTokenAddress(buyer, ownershipMintPda, TOKEN_2022_PROGRAM_ID);

  const instructionData = new Uint8Array(BUY_MODEL_DISCRIMINATOR.length);
  instructionData.set(BUY_MODEL_DISCRIMINATOR, 0);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: buyer, isSigner: true, isWritable: true },
      { pubkey: currentOwner, isSigner: true, isWritable: true },
      { pubkey: modelPda, isSigner: false, isWritable: true },
      { pubkey: ownershipMintPda, isSigner: false, isWritable: false },
      { pubkey: ownerAta, isSigner: false, isWritable: true },
      { pubkey: buyerAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: instructionData as any,
  });

  return new Transaction().add(ix);
}
