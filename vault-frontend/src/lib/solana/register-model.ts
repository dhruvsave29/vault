import {
  PublicKey,
  TransactionInstruction,
  Transaction,
  SystemProgram,
  Connection,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { PROGRAM_ID, getGlobalStatePda, getModelPda, getReputationPda } from "./program";

const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

const REGISTER_MODEL_DISCRIMINATOR = new Uint8Array([111, 236, 93, 31, 195, 210, 142, 125]);

const TASK_TYPE_MAP: Record<string, number> = {
  Classification: 0,
  Sentiment: 1,
  Summarization: 2,
  "Object Detection": 3,
};

function writeU64LE(view: DataView, offset: number, value: number): void {
  const lo = value & 0xffffffff;
  const hi = Math.floor(value / 0x100000000) & 0xffffffff;
  view.setUint32(offset, lo, true);
  view.setUint32(offset + 4, hi, true);
}

function numberToLeBytes(n: number): Uint8Array {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  writeU64LE(view, 0, n);
  return new Uint8Array(buf);
}

function serializeRegisterModelArgs(args: {
  ipfs_cid: string;
  encryption_key_hash: number[];
  model_format: number;
  task_type: number;
  framework_version: string;
  accuracy_claim: number;
  price_per_use: number;
  subscription_price: number;
}): Uint8Array {
  const encoder = new TextEncoder();
  const cidBytes = encoder.encode(args.ipfs_cid);
  const fvBytes = encoder.encode(args.framework_version);

  const totalSize =
    4 + cidBytes.length +
    32 +
    1 +
    1 +
    4 + fvBytes.length +
    2 +
    8 +
    8;

  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let offset = 0;

  view.setUint32(offset, cidBytes.length, true);
  offset += 4;
  u8.set(cidBytes, offset);
  offset += cidBytes.length;

  for (let i = 0; i < 32; i++) {
    u8[offset++] = args.encryption_key_hash[i] || 0;
  }

  u8[offset++] = args.model_format;
  u8[offset++] = args.task_type;

  view.setUint32(offset, fvBytes.length, true);
  offset += 4;
  u8.set(fvBytes, offset);
  offset += fvBytes.length;

  view.setUint16(offset, args.accuracy_claim, true);
  offset += 2;

  writeU64LE(view, offset, args.price_per_use);
  offset += 8;

  writeU64LE(view, offset, args.subscription_price);

  return u8;
}

function getOwnershipMintPda(modelCounter: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("ownership_mint"), numberToLeBytes(modelCounter)],
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

async function fetchModelCounter(connection: Connection): Promise<number> {
  const [globalPda] = getGlobalStatePda();
  const info = await connection.getAccountInfo(globalPda);
  if (!info || !info.data) throw new Error("GlobalState account not found on-chain");

  const data = info.data;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const modelCounter = view.getUint32(8 + 1, true);
  return modelCounter;
}

export async function buildRegisterModelTx(
  authority: PublicKey,
  connection: Connection,
  params: {
    ipfs_cid: string;
    encryption_key_hash: string;
    task_type: string;
    framework_version: string;
    accuracy_claim: number;
    price_per_use: number;
    subscription_price: number;
  }
): Promise<{ tx: Transaction; modelId: number }> {
  const modelCounter = await fetchModelCounter(connection);

  const [globalPda] = getGlobalStatePda();
  const [modelPda] = getModelPda(modelCounter);
  const [reputationPda] = getReputationPda(modelPda);
  const [ownershipMintPda] = getOwnershipMintPda(modelCounter);
  const authorityAta = getAssociatedTokenAddress(authority, ownershipMintPda, TOKEN_2022_PROGRAM_ID);

  const keyHashBytes: number[] = [];
  const hexStr = params.encryption_key_hash.replace(/^0x/, "");
  for (let i = 0; i < 32; i++) {
    if (i * 2 < hexStr.length) {
      keyHashBytes.push(parseInt(hexStr.slice(i * 2, i * 2 + 2), 16));
    } else {
      keyHashBytes.push(0);
    }
  }

  const taskTypeNum = TASK_TYPE_MAP[params.task_type] ?? 0;
  const pricePerUseLamports = Math.round(params.price_per_use * LAMPORTS_PER_SOL);
  const subscriptionPriceLamports = Math.round(params.subscription_price * LAMPORTS_PER_SOL);

  const argsData = serializeRegisterModelArgs({
    ipfs_cid: params.ipfs_cid,
    encryption_key_hash: keyHashBytes,
    model_format: 0,
    task_type: taskTypeNum,
    framework_version: params.framework_version || "unknown",
    accuracy_claim: Math.round(params.accuracy_claim * 100),
    price_per_use: pricePerUseLamports,
    subscription_price: subscriptionPriceLamports,
  });

  const instructionData = new Uint8Array(REGISTER_MODEL_DISCRIMINATOR.length + argsData.length);
  instructionData.set(REGISTER_MODEL_DISCRIMINATOR, 0);
  instructionData.set(argsData, REGISTER_MODEL_DISCRIMINATOR.length);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: globalPda, isSigner: false, isWritable: true },
      { pubkey: modelPda, isSigner: false, isWritable: true },
      { pubkey: reputationPda, isSigner: false, isWritable: true },
      { pubkey: ownershipMintPda, isSigner: false, isWritable: true },
      { pubkey: authorityAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: instructionData as any,
  });

  const tx = new Transaction().add(ix);

  return { tx, modelId: modelCounter };
}
