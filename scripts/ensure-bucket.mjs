#!/usr/bin/env node
/**
 * Creates the private file bucket in Supabase Storage (S3 API) if it does not exist yet.
 * Env: SUPABASE_DB_URL (to find the project ref and region), STORAGE_S3_ACCESS_KEY, STORAGE_S3_SECRET_KEY,
 * optional STORAGE_S3_BUCKET (default epm-files).
 */
import { S3Client, HeadBucketCommand, CreateBucketCommand } from "@aws-sdk/client-s3";

const raw = process.env.SUPABASE_DB_URL;
if (!raw) { console.error("::error::SUPABASE_DB_URL secret is missing"); process.exit(1); }
const u = new URL(raw);
const ref = decodeURIComponent(u.username).split(".")[1] || u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1];
const region = u.hostname.match(/^aws-\d+-([a-z0-9-]+)\.pooler\.supabase\.com$/)?.[1] || "eu-west-1";
const Bucket = process.env.STORAGE_S3_BUCKET || "epm-files";
if (!ref) { console.error("::error::Could not read the Supabase project ref from SUPABASE_DB_URL"); process.exit(1); }

const s3 = new S3Client({
  region, forcePathStyle: true,
  endpoint: `https://${ref}.storage.supabase.co/storage/v1/s3`,
  credentials: { accessKeyId: process.env.STORAGE_S3_ACCESS_KEY ?? "", secretAccessKey: process.env.STORAGE_S3_SECRET_KEY ?? "" },
});

try {
  await s3.send(new HeadBucketCommand({ Bucket }));
  console.log(`Bucket ${Bucket} exists.`);
} catch (e) {
  const code = e?.$metadata?.httpStatusCode;
  if (code === 403) { console.error("::error::Supabase refused the S3 keys (403). Check STORAGE_S3_ACCESS_KEY and STORAGE_S3_SECRET_KEY."); process.exit(1); }
  await s3.send(new CreateBucketCommand({ Bucket }));
  console.log(`Created private bucket ${Bucket}.`);
}
