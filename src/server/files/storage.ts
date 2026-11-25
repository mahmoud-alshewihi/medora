import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { badRequest } from "@/lib/errors";

const ALLOWED: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  "application/pdf": { ext: "pdf", magic: (b) => b.subarray(0, 5).toString() === "%PDF-" },
  "image/png": { ext: "png", magic: (b) => b.subarray(1, 4).toString() === "PNG" },
  "image/jpeg": { ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
};
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Validates declared type against file signature, stores outside the web root under a random key. */
export async function saveUpload(clinicId: string, file: { name: string; type: string; data: Buffer }) {
  const rule = ALLOWED[file.type];
  if (!rule) throw badRequest("Only PDF, PNG and JPEG files are allowed");
  if (file.data.length > MAX_UPLOAD_BYTES) throw badRequest("File exceeds 5 MB");
  if (file.data.length === 0) throw badRequest("Empty file");
  if (!rule.magic(file.data)) throw badRequest("File content does not match its declared type");
  const key = `${clinicId}/${randomUUID()}.${rule.ext}`;
  const full = path.resolve(env().UPLOAD_DIR, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, file.data, { mode: 0o600 });
  return { storageKey: key, sizeBytes: file.data.length, safeName: file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) };
}

export async function readUpload(key: string) {
  const base = path.resolve(env().UPLOAD_DIR);
  const full = path.resolve(base, key);
  if (!full.startsWith(base + path.sep)) throw badRequest("Invalid file key");
  return readFile(full);
}
