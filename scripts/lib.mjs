// Shared helpers for the Ethos deploy/seed/verify scripts.
// Reads ACCOUNT_PRIVATE_KEY from process.env only; never prints it.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

// Load the repo-root .env (the funded key lives here).
dotenv.config({ path: path.join(repoRoot, ".env") });

export const EXPLORER = "https://explorer-bradbury.genlayer.com";
export const CONTRACT_PATH = path.join(repoRoot, "contracts", "ethos.py");
export const DEPLOYMENT_PATH = path.join(repoRoot, "deployment.json");

export function txUrl(hash) {
  return `${EXPLORER}/tx/${hash}`;
}

export function requireKey() {
  const key = process.env.ACCOUNT_PRIVATE_KEY;
  if (!key || key.length < 10) {
    throw new Error("ACCOUNT_PRIVATE_KEY is missing from .env");
  }
  return key.startsWith("0x") ? key : `0x${key}`;
}

export function makeClient() {
  const account = createAccount(requireKey());
  const client = createClient({ chain: testnetBradbury, account });
  return { client, account };
}

export function readContractCode() {
  return new Uint8Array(readFileSync(CONTRACT_PATH));
}

// Retry with exponential backoff. Guards against gen_call / RPC rate limits.
export async function withRetry(label, fn, { retries = 6, base = 2000 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      const rateLimited = /429|rate|-32429|-32028|timeout|ECONN|fetch failed/i.test(msg);
      if (attempt === retries || !rateLimited) throw err;
      const wait = base * attempt;
      console.warn(`  ${label}: attempt ${attempt} failed (${msg.slice(0, 80)}); retrying in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
