// Explanations for transaction failures, shown in the console.
//
// Bradbury's RPC server accepts only integer JSON-RPC request ids, while
// MetaMask stamps requests with string ids. Browser writes therefore route
// through an id-normalizing proxy (see the "Network primer" section). These
// explainers turn raw error text into the actual cause so a visitor who hits
// an error understands what happened and what to do, instead of staring at
// "An internal error was received."

const RULES = [
  {
    // MetaMask pointed at the raw Bradbury RPC -> string id rejected.
    test: (m) => /cannot unmarshal|Request\.id of type int|Parse error as|null value in array/i.test(m),
    title: "Wallet is on the old, direct RPC",
    body: "The wallet is configured with the raw Bradbury RPC, which rejects MetaMask's string request ids. Remove the “GenLayer Testnet Bradbury” entry in the wallet (Settings → Networks), then click Connect again — the app re-adds the network with the proxy RPC that accepts the wallet's requests.",
  },
  {
    // Chain missing from wallet.
    test: (m) => /4902|Unrecognized chain|may not be added|chain not found/i.test(m),
    title: "Bradbury is not in the wallet yet",
    body: "Click “Switch to Bradbury” or Connect — the app adds the network (chain id 4221, GEN) with the proxy RPC automatically.",
  },
  {
    // User rejected in the wallet.
    test: (m) => /4001|User rejected|User denied|declined/i.test(m),
    title: "The request was declined in the wallet",
    body: "The signature prompt was rejected, so the transaction was never submitted. Nothing changed on chain.",
  },
  {
    // Another signing request already pending.
    test: (m) => /-32002|already pending|request already pending/i.test(m),
    title: "A wallet request is already pending",
    body: "MetaMask is still waiting on an earlier prompt. Approve or reject it first, then resubmit.",
  },
  {
    // Contract-level deterministic revert: the app's own business rules.
    test: (m) => /\[EXPECTED\]|already exists|too short|Unknown license|requires a non-zero|Nothing to claim|would revert/i.test(m),
    title: "The contract rejected the call",
    body: "This is the contract's own rule, not a network problem. The exact reason is in the error text (for example: license already registered, manifest or evidence too short, unknown license, zero deposit, nothing to claim).",
  },
  {
    // Consensus pending is normal for audit.
    test: (m) => /pending|timed out|timeout/i.test(m),
    title: "Consensus is still running",
    body: "Audits run real validator consensus — each validator reads the manifest and evidence and agrees on a verdict. A verdict transaction legitimately takes longer than a plain transfer; keep the tab open or re-read the license after a while.",
  },
  {
    // RPC/network transient errors.
    test: (m) => /429|rate|-32429|-32028|fetch failed|ECONN|network/i.test(m),
    title: "Transient RPC error",
    body: "The RPC or the proxy hiccuped. Writes are retried automatically a few times; if it persists, wait a moment and resubmit.",
  },
  {
    // Fallback: unknown error.
    test: () => true,
    title: "The transaction did not go through",
    body: "The full error text is shown above. Most failures are one of the listed cases; if the wallet is on the proxy RPC and the text mentions none of them, screenshot the console and it can be diagnosed.",
  },
];

export function explainError(err) {
  const m = String(err?.shortMessage || err?.message || err || "");
  for (const r of RULES) {
    if (r.test(m)) return { title: r.title, body: r.body };
  }
  return { title: "The transaction did not go through", body: "The full error text is shown above." };
}
