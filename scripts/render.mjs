#!/usr/bin/env node
/**
 * Render control script for GitHub Actions. Node 20+, no dependencies.
 *   node scripts/render.mjs sync             create the web service if missing, then write its env vars
 *   node scripts/render.mjs deploy [sha]     deploy a commit (default: branch head) and wait until live
 *   node scripts/render.mjs status           service URL, latest deploys, health
 *   node scripts/render.mjs logs [n]         last n app log lines (emails, IPs and tokens redacted)
 *   node scripts/render.mjs restart | rollback
 *   node scripts/render.mjs export-env [--optional] KEY…  write the service's values for KEY… to $GITHUB_ENV (masked);
 *                                        --optional sets RENDER_NOT_READY=true instead of failing before the first deploy
 *
 * Inputs (env): RENDER_API_KEY, and for `sync`: SUPABASE_DB_URL, STORAGE_S3_ACCESS_KEY, STORAGE_S3_SECRET_KEY,
 * BREVO_API_KEY, MAIL_FROM. Secrets the app needs but nobody has to type (APP_ENCRYPTION_KEY, CRON_SECRET,
 * BACKUP_PASSPHRASE) are generated once and kept on the Render service; later syncs never change them.
 * Nothing secret is printed: every value is masked in the Actions log before use.
 */
import { randomBytes } from "node:crypto";
import { appendFileSync } from "node:fs";

const API = process.env.RENDER_API_BASE || "https://api.render.com/v1";
const SERVICE_NAME = process.env.RENDER_SERVICE_NAME || "lumen-pmo";
const REGION = process.env.RENDER_REGION || "frankfurt";
const REPO = process.env.RENDER_REPO || `https://github.com/${process.env.GITHUB_REPOSITORY || "ahmeddosoky90/epm-platform"}`;
const BRANCH = process.env.RENDER_BRANCH || "main";
const GENERATED = ["APP_ENCRYPTION_KEY", "CRON_SECRET", "BACKUP_PASSPHRASE"];

const mask = (v) => { if (v && process.env.GITHUB_ACTIONS) for (const line of String(v).split("\n")) if (line) console.log(`::add-mask::${line}`); };
const die = (msg) => { console.error(`::error::${msg}`); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function render(method, path, body) {
  const key = process.env.RENDER_API_KEY;
  if (!key) die("RENDER_API_KEY secret is missing");
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { authorization: `Bearer ${key}`, accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429 || res.status >= 500) { if (attempt < 4) { await sleep(2000 * attempt); continue; } }
    const text = await res.text();
    if (!res.ok) die(`Render API ${method} ${path} → ${res.status}: ${text.slice(0, 500)}`);
    return text ? JSON.parse(text) : null;
  }
}

async function ownerId() {
  const owners = await render("GET", "/owners?limit=20");
  if (!owners?.length) die("No Render workspace found for this API key");
  return owners[0].owner.id;
}

async function findService() {
  const list = await render("GET", `/services?name=${encodeURIComponent(SERVICE_NAME)}&limit=20`);
  return list.map((x) => x.service).find((s) => s.name === SERVICE_NAME) ?? null;
}
async function requireService() { return (await findService()) ?? die(`Render service "${SERVICE_NAME}" does not exist yet; run the deploy workflow first`); }

async function getEnv(serviceId) {
  const out = {}; let cursor = "";
  for (;;) {
    const page = await render("GET", `/services/${serviceId}/env-vars?limit=100${cursor ? `&cursor=${cursor}` : ""}`);
    for (const x of page) out[x.envVar.key] = x.envVar.value;
    if (page.length < 100) return out;
    cursor = page.at(-1).cursor;
  }
}

/** Supabase session-pooler URL → { url for Prisma, project ref, region }. */
function parseSupabase(raw) {
  if (!raw) die("SUPABASE_DB_URL secret is missing");
  if (raw.includes("[YOUR-PASSWORD]")) die("SUPABASE_DB_URL still contains [YOUR-PASSWORD]; put the database password in its place");
  let u; try { u = new URL(raw); } catch { die("SUPABASE_DB_URL is not a valid postgresql:// URL"); }
  mask(decodeURIComponent(u.password));
  const ref = decodeURIComponent(u.username).split(".")[1] || u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1];
  const region = u.hostname.match(/^aws-\d+-([a-z0-9-]+)\.pooler\.supabase\.com$/)?.[1];
  if (!ref) die("Could not read the Supabase project ref from SUPABASE_DB_URL (expected user postgres.<ref>)");
  if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "5");
  if (!u.searchParams.has("schema")) u.searchParams.set("schema", "public");
  return { url: u.toString(), ref, region: region || "eu-west-1" };
}

function desiredEnv(existing, appUrl) {
  const db = parseSupabase(process.env.SUPABASE_DB_URL);
  const need = (k) => process.env[k] || die(`${k} secret is missing`);
  const env = {
    NODE_ENV: "production",
    NODE_OPTIONS: "--max-old-space-size=384",
    RUN_MIGRATIONS: "false", // GitHub Actions migrates before each deploy
    APP_URL: appUrl,
    COOKIE_SECURE: "true",
    DATABASE_URL: db.url,
    STORAGE_DRIVER: "s3",
    STORAGE_S3_BUCKET: process.env.STORAGE_S3_BUCKET || "epm-files",
    STORAGE_S3_ENDPOINT: `https://${db.ref}.storage.supabase.co/storage/v1/s3`,
    STORAGE_S3_REGION: db.region,
    STORAGE_S3_FORCE_PATH_STYLE: "true",
    STORAGE_S3_ACCESS_KEY: need("STORAGE_S3_ACCESS_KEY"),
    STORAGE_S3_SECRET_KEY: need("STORAGE_S3_SECRET_KEY"),
    BREVO_API_KEY: need("BREVO_API_KEY"),
    MAIL_FROM: need("MAIL_FROM"),
    EMAIL_NOTIFICATIONS: "on",
  };
  for (const k of GENERATED) env[k] = existing[k] || randomBytes(36).toString("base64url");
  // Keep anything set by hand in the Render dashboard that this script does not own.
  return { ...existing, ...env };
}

async function sync() {
  let svc = await findService();
  let created = false;
  if (!svc) {
    // Settings go in with the create call, because Render starts a first build straight away.
    const initial = desiredEnv({}, process.env.APP_URL_OVERRIDE || `https://${SERVICE_NAME}.onrender.com`);
    for (const k of [...GENERATED, "DATABASE_URL", "STORAGE_S3_ACCESS_KEY", "STORAGE_S3_SECRET_KEY", "BREVO_API_KEY", "MAIL_FROM"]) mask(initial[k]);
    const res = await render("POST", "/services", {
      type: "web_service", name: SERVICE_NAME, ownerId: await ownerId(), repo: REPO, branch: BRANCH, autoDeploy: "no",
      envVars: Object.entries(initial).map(([key, value]) => ({ key, value })),
      serviceDetails: {
        runtime: "docker", plan: "free", region: REGION, healthCheckPath: "/api/health",
        envSpecificDetails: { dockerfilePath: "./Dockerfile", dockerContext: "." },
      },
    });
    svc = res.service ?? res;
    created = true;
    console.log(`Created Render service ${SERVICE_NAME} (${svc.id}).`);
  }
  const appUrl = (process.env.APP_URL_OVERRIDE || svc.serviceDetails?.url || `https://${SERVICE_NAME}.onrender.com`).replace(/\/$/, "");
  const existing = await getEnv(svc.id);
  const env = desiredEnv(existing, appUrl);
  for (const k of [...GENERATED, "DATABASE_URL", "STORAGE_S3_ACCESS_KEY", "STORAGE_S3_SECRET_KEY", "BREVO_API_KEY", "MAIL_FROM"]) mask(env[k]);
  const changed = Object.keys(env).filter((k) => env[k] !== existing[k]);
  if (changed.length) {
    await render("PUT", `/services/${svc.id}/env-vars`, Object.entries(env).map(([key, value]) => ({ key, value })));
    console.log(`Updated env vars: ${changed.sort().join(", ")}`);
  } else console.log("Env vars already up to date.");
  output({ service_id: svc.id, app_url: appUrl, created: String(created) });
  return svc;
}

function output(kv) {
  for (const [k, v] of Object.entries(kv)) {
    console.log(`${k}=${v}`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);
  }
}

const FINAL_OK = new Set(["live"]);
const FINAL_BAD = new Set(["build_failed", "update_failed", "canceled", "pre_deploy_failed", "deactivated"]);

async function waitFor(serviceId, deployId, minutes = 30) {
  const until = Date.now() + minutes * 60_000;
  let last = "";
  while (Date.now() < until) {
    const d = await render("GET", `/services/${serviceId}/deploys/${deployId}`);
    if (d.status !== last) { console.log(`deploy ${deployId}: ${d.status}`); last = d.status; }
    if (FINAL_OK.has(d.status)) return d;
    if (FINAL_BAD.has(d.status)) { await logs(80).catch(() => {}); die(`Deploy ${deployId} ended as ${d.status}`); }
    await sleep(15_000);
  }
  die(`Deploy ${deployId} not live after ${minutes} minutes`);
}

async function deploy(sha) {
  const svc = await requireService();
  const d = await render("POST", `/services/${svc.id}/deploys`, { clearCache: "do_not_clear", ...(sha ? { commitId: sha } : {}) });
  console.log(`Started deploy ${d.id}${sha ? ` of ${sha.slice(0, 7)}` : ""}.`);
  await waitFor(svc.id, d.id);
  await health(svc.serviceDetails?.url);
}

async function health(url, tries = 12) {
  if (!url) return;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(90_000) });
      const body = await res.text();
      console.log(`health ${res.status}: ${body.slice(0, 200)}`);
      if (res.ok) return true;
    } catch (e) { console.log(`health attempt ${i}: ${e.message}`); }
    await sleep(10_000);
  }
  die("Health check failed");
}

const REDACT = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "<email>"],
  [/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "<ip>"],
  [/\b[0-9a-f]{1,4}(?::[0-9a-f]{0,4}){4,7}\b/gi, "<ip>"],
  [/(token|ticket|password|secret|key|authorization)([=:"' ]+)[^\s&"',]+/gi, "$1$2<redacted>"],
  [/postgres(?:ql)?:\/\/[^\s]+/gi, "<db-url>"],
];
const redact = (s) => REDACT.reduce((t, [re, rep]) => t.replace(re, rep), s);

async function logs(n = 200) {
  const svc = await requireService();
  const q = new URLSearchParams({ ownerId: svc.ownerId || (await ownerId()), resource: svc.id, limit: String(Math.min(Number(n) || 200, 1000)), direction: "backward" });
  const res = await render("GET", `/logs?${q}`);
  const lines = (res.logs ?? []).slice().reverse();
  for (const l of lines) console.log(`${l.timestamp}  ${redact(String(l.message ?? "")).slice(0, 2000)}`);
  if (!lines.length) console.log("(no log lines returned)");
}

async function status() {
  const svc = await findService();
  if (!svc) return console.log(`Render service "${SERVICE_NAME}" does not exist yet.`);
  console.log(`service ${svc.name} ${svc.id} suspended=${svc.suspended} url=${svc.serviceDetails?.url}`);
  for (const { deploy: d } of await render("GET", `/services/${svc.id}/deploys?limit=5`)) {
    console.log(`  ${d.createdAt}  ${d.status.padEnd(18)} ${d.id}  ${d.commit?.id?.slice(0, 7) ?? ""} ${(d.commit?.message ?? "").split("\n")[0].slice(0, 70)}`);
  }
  await health(svc.serviceDetails?.url, 3).catch(() => {});
}

async function restart() {
  const svc = await requireService();
  await render("POST", `/services/${svc.id}/restart`);
  console.log("Restart requested.");
  await health(svc.serviceDetails?.url);
}

async function rollback() {
  const svc = await requireService();
  const deploys = (await render("GET", `/services/${svc.id}/deploys?limit=20`)).map((x) => x.deploy);
  const live = deploys.findIndex((d) => d.status === "live");
  const target = deploys.slice(live + 1).find((d) => d.status === "deactivated");
  if (live < 0 || !target) die("No earlier successful deploy to roll back to");
  const d = await render("POST", `/services/${svc.id}/rollback`, { deployId: target.id });
  console.log(`Rolling back to ${target.id} (${target.commit?.id?.slice(0, 7) ?? "?"}).`);
  await waitFor(svc.id, d.id);
  await health(svc.serviceDetails?.url);
}

async function exportEnv(keys) {
  const optional = keys[0] === "--optional";
  if (optional) keys = keys.slice(1);
  const svc = optional && !process.env.RENDER_API_KEY ? null : optional ? await findService() : await requireService();
  if (!svc) {
    console.log(`::notice::Render service "${SERVICE_NAME}" is not set up yet; skipping.`);
    if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, "RENDER_NOT_READY=true\n");
    return;
  }
  const env = await getEnv(svc.id);
  const lines = [];
  for (const k of keys) {
    if (k === "APP_URL" && !env[k]) env[k] = svc.serviceDetails?.url;
    if (env[k] === undefined) die(`${k} is not set on the Render service`);
    if (k !== "APP_URL") mask(env[k]);
    lines.push(`${k}=${env[k]}`);
  }
  if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, lines.join("\n") + "\n");
  console.log(`Exported ${keys.join(", ")}.`);
}

const [cmd, ...args] = process.argv.slice(2);
const commands = { sync, deploy: () => deploy(args[0]), status, logs: () => logs(args[0]), restart, rollback, "export-env": () => exportEnv(args) };
if (!commands[cmd]) die(`Unknown command "${cmd ?? ""}". Use: ${Object.keys(commands).join(", ")}`);
await commands[cmd]();
