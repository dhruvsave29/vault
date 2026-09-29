const GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs/";

export async function uploadToIPFS(encryptedBlob: Blob): Promise<{ cid: string; gatewayUrl: string }> {
  const formData = new FormData();
  formData.append("file", encryptedBlob, "model.encrypted");

  const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/upload/ipfs`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`IPFS upload failed: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    cid: data.ipfs_cid,
    gatewayUrl: `${GATEWAY}${data.ipfs_cid}`,
  };
}

export async function downloadFromIPFS(cid: string): Promise<ArrayBuffer> {
  const response = await fetch(`${GATEWAY}${cid}`);
  if (!response.ok) {
    throw new Error(`IPFS download failed: ${response.statusText}`);
  }
  return response.arrayBuffer();
}

export function verifyOnIPFS(cid: string): Promise<boolean> {
  return fetch(`${GATEWAY}${cid}`, { method: "HEAD" }).then(
    (r) => r.ok,
    () => false
  );
}
