import {
  PublicKey,
  TransactionInstruction,
  Transaction,
  Connection,
} from "@solana/web3.js";
import { PROGRAM_ID, getModelPda } from "./program";

const ADD_CONTRIBUTOR_DISCRIMINATOR = new Uint8Array([
  0x7d, 0xdd, 0xa2, 0xb6, 0xbf, 0x1a, 0xce, 0xdb,
]);

function writeU16LE(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function serializeAddContributorArgs(args: {
  contributor: PublicKey;
  share: number;
  proof_hash: number[];
}): Uint8Array {
  const totalSize = 32 + 2 + 32;
  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let offset = 0;

  u8.set(args.contributor.toBytes(), offset);
  offset += 32;

  writeU16LE(view, offset, args.share);
  offset += 2;

  for (let i = 0; i < 32; i++) {
    u8[offset++] = args.proof_hash[i] || 0;
  }

  return u8;
}

export async function buildAddContributorTx(
  authority: PublicKey,
  modelId: number,
  contributor: PublicKey,
  sharePercent: number,
  connection: Connection
): Promise<Transaction> {
  const [modelPda] = getModelPda(modelId);

  const shareBps = Math.round(sharePercent * 100);

  const proofHash: number[] = new Array(32).fill(0);
  const contributorBytes = contributor.toBytes();
  for (let i = 0; i < 32; i++) {
    proofHash[i] = contributorBytes[i] ^ 0x42;
  }

  const argsData = serializeAddContributorArgs({
    contributor,
    share: shareBps,
    proof_hash: proofHash,
  });

  const instructionData = new Uint8Array(ADD_CONTRIBUTOR_DISCRIMINATOR.length + argsData.length);
  instructionData.set(ADD_CONTRIBUTOR_DISCRIMINATOR, 0);
  instructionData.set(argsData, ADD_CONTRIBUTOR_DISCRIMINATOR.length);

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
