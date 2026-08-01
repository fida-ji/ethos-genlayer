// Thin wrapper over genlayer-js for the Ethos frontend.
// - One shared read client (no wallet) for view calls.
// - A per-session write client bound to the connected wallet.
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { CONTRACT_ADDRESS } from "./config.js";

let readClient = null;
function getReadClient() {
  if (!readClient) readClient = createClient({ chain: testnetBradbury });
  return readClient;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retry with backoff. Guards reads against gen_call rate limits / transient RPC.
async function withRetry(fn, { retries = 4, base = 1200 } = {}) {
  let lastErr;
  for (let i = 1; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      const transient = /429|rate|-32429|-32028|timeout|fetch|network|ECONN/i.test(msg);
      if (i === retries || !transient) throw err;
      await sleep(base * i);
    }
  }
  throw lastErr;
}

export async function read(functionName, args = []) {
  const client = getReadClient();
  return withRetry(() =>
    client.readContract({ address: CONTRACT_ADDRESS, functionName, args })
  );
}

// Build a write client bound to the wallet. `provider` is window.ethereum.
export function makeWriteClient(address, provider) {
  return createClient({ chain: testnetBradbury, account: address, provider });
}

// Ensure the wallet is on Bradbury (adds the chain if missing). No Snaps.
export async function ensureNetwork(client) {
  await client.connect("testnetBradbury");
}

// Submit a write and drive a status callback through the tx lifecycle.
export async function write(client, functionName, args, { value = 0n, onPhase } = {}) {
  onPhase?.({ phase: "submitting", label: "Awaiting wallet signature" });
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    value,
  });
  onPhase?.({ phase: "pending", label: "Submitted to consensus", hash });
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    retries: 300,
    interval: 5000,
  });
  onPhase?.({ phase: "accepted", label: "Accepted by validators", hash, receipt });
  return { hash, receipt };
}
