import fs from "node:fs/promises";
import path from "node:path";

const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");

function normalizeKey(relKey: string) {
  return relKey.replace(/^\/+/, "").replace(/\.\./g, "_");
}

function appendHashSuffix(relKey: string) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  _contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const target = path.resolve(UPLOAD_ROOT, key);
  if (!target.startsWith(`${UPLOAD_ROOT}${path.sep}`)) throw new Error("Invalid upload path");
  await fs.mkdir(path.dirname(target), { recursive: true });
  const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  await fs.writeFile(target, buffer);
  return { key, url: `/uploads/${key}` };
}

export async function storageGet(relKey: string) {
  const key = normalizeKey(relKey);
  return { key, url: `/uploads/${key}` };
}

export async function storageGetSignedUrl(relKey: string) {
  return `/uploads/${normalizeKey(relKey)}`;
}
