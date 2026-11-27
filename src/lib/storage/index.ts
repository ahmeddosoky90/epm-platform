/**
 * File storage for attachments and documents.
 *   STORAGE_DRIVER=local → files under STORAGE_LOCAL_DIR (default ./storage)
 *   STORAGE_DRIVER=s3    → any S3-compatible bucket (AWS S3, Supabase Storage, MinIO, Cloudflare R2 …)
 * Keys carry the driver as a prefix ("local:…" / "s3:…"), so the driver can change later
 * without breaking files that were stored before.
 */
import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { badRequest, notFound } from "../errors";

const MAX_MB = Number(process.env.UPLOAD_MAX_MB ?? 25);

/** Office, PDF, images, text, archives and project files. No HTML, SVG, scripts or executables. */
const ALLOWED_EXT = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "xlsm", "ppt", "pptx", "odt", "ods", "odp", "rtf", "txt", "csv", "md", "json", "xml",
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "tif", "tiff", "zip", "7z", "msg", "eml", "vsd", "vsdx", "mpp", "log",
]);

const startsWith = (b: Buffer, sig: number[], at = 0) => b.length >= at + sig.length && sig.every((v, i) => b[at + i] === v);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

const EXECUTABLE: number[][] = [
  ascii("MZ"),                 // Windows PE
  [0x7f, 0x45, 0x4c, 0x46],    // ELF
  [0xfe, 0xed, 0xfa, 0xce], [0xfe, 0xed, 0xfa, 0xcf], [0xce, 0xfa, 0xed, 0xfe], [0xcf, 0xfa, 0xed, 0xfe], // Mach-O
  [0xca, 0xfe, 0xba, 0xbe],    // Mach-O fat / Java class
  ascii("#!"),                 // shell scripts
];

const ZIP = ascii("PK\u0003\u0004");
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
/** Formats whose bytes must match their extension. */
const MAGIC: Record<string, (b: Buffer) => boolean> = {
  pdf: (b) => startsWith(b, ascii("%PDF-")),
  png: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  jpg: (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  jpeg: (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  gif: (b) => startsWith(b, ascii("GIF87a")) || startsWith(b, ascii("GIF89a")),
  webp: (b) => startsWith(b, ascii("RIFF")) && startsWith(b, ascii("WEBP"), 8),
  bmp: (b) => startsWith(b, ascii("BM")),
  docx: (b) => startsWith(b, ZIP), xlsx: (b) => startsWith(b, ZIP), xlsm: (b) => startsWith(b, ZIP), pptx: (b) => startsWith(b, ZIP),
  vsdx: (b) => startsWith(b, ZIP), zip: (b) => startsWith(b, ZIP),
  doc: (b) => startsWith(b, OLE), xls: (b) => startsWith(b, OLE), ppt: (b) => startsWith(b, OLE), msg: (b) => startsWith(b, OLE),
};
const TEXT_EXT = new Set(["txt", "csv", "md", "json", "xml", "log", "eml"]);

/** A file name safe for storage keys and Content-Disposition headers. */
export function safeName(name: string): string {
  const base = path.basename(String(name ?? "").replace(/\\/g, "/"));
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>:|?*;\\/]/g, "_").replace(/\s+/g, " ").trim().replace(/^\.+/, "");
  if (!cleaned) return "file";
  if (cleaned.length <= 150) return cleaned;
  const ext = path.extname(cleaned).slice(0, 12);
  return cleaned.slice(0, 150 - ext.length) + ext;
}

/** Rejects oversize, unlisted, executable, active-content and mislabelled files. Throws a 400. */
export function validateUpload(name: string, bytes: Buffer): void {
  if (!bytes.length) throw badRequest("The file is empty.");
  if (bytes.length > MAX_MB * 1024 * 1024) throw badRequest(`The file is larger than ${MAX_MB} MB.`);
  const ext = path.extname(safeName(name)).slice(1).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) throw badRequest(`Files of type .${ext || "(none)"} are not allowed.`);
  if (EXECUTABLE.some((sig) => startsWith(bytes, sig))) throw badRequest("Executable files are not allowed.");
  const check = MAGIC[ext];
  if (check && !check(bytes)) throw badRequest(`The file's contents do not match its .${ext} extension.`);
  if (TEXT_EXT.has(ext)) {
    const head = bytes.subarray(0, 4096).toString("utf8").toLowerCase();
    if (/<script[\s>]|<iframe[\s>]|<html[\s>]|javascript:/.test(head)) throw badRequest("Files with active web content are not allowed.");
  }
}

// ─── Drivers ──────────────────────────────────────────────────────────────

const driver = () => (process.env.STORAGE_DRIVER === "s3" ? "s3" : "local");
const localRoot = () => path.resolve(process.env.STORAGE_LOCAL_DIR ?? "./storage");

function localPath(rel: string) {
  const root = localRoot();
  const full = path.resolve(root, rel);
  if (full !== root && !full.startsWith(root + path.sep)) throw notFound("File");
  return full;
}

let s3: S3Client | null = null;
function s3Client() {
  if (!s3) {
    const endpoint = process.env.STORAGE_S3_ENDPOINT || undefined;
    s3 = new S3Client({
      region: process.env.STORAGE_S3_REGION || "us-east-1",
      endpoint,
      // Supabase Storage and MinIO need path-style URLs; AWS works either way.
      forcePathStyle: process.env.STORAGE_S3_FORCE_PATH_STYLE ? process.env.STORAGE_S3_FORCE_PATH_STYLE === "true" : !!endpoint,
      credentials: process.env.STORAGE_S3_ACCESS_KEY
        ? { accessKeyId: process.env.STORAGE_S3_ACCESS_KEY, secretAccessKey: process.env.STORAGE_S3_SECRET_KEY ?? "" }
        : undefined,
    });
  }
  return s3;
}
const bucket = () => {
  const b = process.env.STORAGE_S3_BUCKET;
  if (!b) throw new Error("STORAGE_S3_BUCKET is not set");
  return b;
};

/** Stores bytes under `prefix` and returns the key to keep in the database. */
export async function putObject(prefix: string, name: string, bytes: Buffer, contentType: string): Promise<{ key: string; size: number }> {
  const cleanPrefix = prefix.split("/").filter((p) => p && p !== "." && p !== "..").join("/");
  const rel = `${cleanPrefix}/${randomUUID()}-${safeName(name)}`;
  if (driver() === "s3") {
    await s3Client().send(new PutObjectCommand({ Bucket: bucket(), Key: rel, Body: bytes, ContentType: contentType || "application/octet-stream" }));
    return { key: `s3:${rel}`, size: bytes.length };
  }
  const full = localPath(rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes, { flag: "wx" });
  return { key: `local:${rel}`, size: bytes.length };
}

/** Reads a stored object by the key that putObject returned. */
export async function getObject(key: string): Promise<Buffer> {
  const i = key.indexOf(":");
  const kind = i > 0 ? key.slice(0, i) : "local";
  const rel = i > 0 ? key.slice(i + 1) : key;
  if (kind === "s3") {
    try {
      const out = await s3Client().send(new GetObjectCommand({ Bucket: bucket(), Key: rel }));
      return Buffer.from(await out.Body!.transformToByteArray());
    } catch (e) {
      if ((e as { name?: string }).name === "NoSuchKey") throw notFound("File");
      throw e;
    }
  }
  try { return await readFile(localPath(rel)); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") throw notFound("File"); throw e; }
}
