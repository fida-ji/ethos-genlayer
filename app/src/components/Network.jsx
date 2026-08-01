import { useState } from "react";
import { CHAIN_PARAMS, RPC_PROXY, RPC_DIRECT, CHAIN_ID, EXPLORER, FAUCET } from "../config.js";

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function CopyField({ label, value, mono = true }) {
  const [done, setDone] = useState(false);
  return (
    <div className="cfg-row">
      <span className="k">{label}</span>
      <button
        type="button"
        className="btn btn-sm btn-copy"
        onClick={async () => {
          if (await copyText(value)) {
            setDone(true);
            setTimeout(() => setDone(false), 1600);
          }
        }}
        title="Copy to clipboard"
      >
        {done ? "copied" : "copy"}
      </button>
      <span className={`v ${mono ? "mono" : ""}`} onClick={() => copyText(value)} title="Click to copy">{value}</span>
    </div>
  );
}

function CopyJson() {
  const [done, setDone] = useState(false);
  const json = JSON.stringify(
    {
      chainId: CHAIN_ID,
      chainName: CHAIN_PARAMS.chainName,
      rpc: [RPC_PROXY],
      symbol: "GEN",
      explorer: EXPLORER,
    },
    null,
    2
  );
  return (
    <button
      type="button"
      className="btn btn-sm"
      onClick={async () => {
        if (await copyText(json)) {
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        }
      }}
      title="Copy the full network config as JSON"
    >
      {done ? "copied — paste into a wallet" : "Copy chain config (JSON)"}
    </button>
  );
}

// Each row: a failure mode visitors can actually hit, with a plain reason.
const FAILURES = [
  {
    chip: "struck",
    tag: "Old RPC entry",
    title: "Wallet still points at the raw Bradbury RPC",
    body: "If the wallet added Bradbury before this dapp, its RPC is the raw endpoint, which rejects MetaMask's request format. Remove that network entry (Settings → Networks), then reconnect — the app adds it again with the proxy RPC.",
  },
  {
    chip: "neutral",
    tag: "Consensus",
    title: "Audits take time — that is the point",
    body: "Every audit is judged by real validators: each reads the manifest and evidence and agrees on a verdict before anything settles. Pending on an audit is normal; a plain transfer resolves faster.",
  },
  {
    chip: "struck",
    tag: "Contract rule",
    title: "The contract rejected the call",
    body: "Reverts such as “license already exists”, “manifest too short”, “unknown license”, or “nothing to claim” are the contract's own rules — the exact reason is in the error text. No network involved.",
  },
  {
    chip: "neutral",
    tag: "Wrong network",
    title: "Wallet is on another chain",
    body: "The banner offers a one-click switch to Bradbury (chain id 4221). Reads work regardless; writes need the wallet on Bradbury.",
  },
  {
    chip: "neutral",
    tag: "No funds",
    title: "Deposits need test GEN",
    body: "The faucet mints testnet GEN for the wallet address. Payouts and deposits are real value at risk — funded by the faucet, not by this page.",
  },
];

export function NetworkSection() {
  return (
    <section className="section" id="network">
      <div className="wrap">
        <div className="eyebrow">Network &amp; RPC</div>
        <h2 className="lead" style={{ marginBottom: 34 }}>
          One quirk on Bradbury's RPC, solved with a relay.
        </h2>

        <div className="net-grid">
          <div className="net-cell">
            <div className="net-intro">
              <p>
                Reads on this page (the docket, stats, audit records) call the contract's view
                methods straight against the Bradbury RPC — no wallet needed.
              </p>
              <p>
                <strong>Writes are the one hard part.</strong> Bradbury's RPC server accepts only
                <em> integer</em> JSON-RPC request ids, while MetaMask stamps every request with a
                string id. A wallet pointed at the raw RPC is therefore refused with a parse error
                the moment it tries to broadcast a signed transaction.
              </p>
              <p>
                Ethos ships with a small, stateless relay —{" "}
                <a href="https://github.com/fida-ji/ethos-genlayer/tree/main/proxy" target="_blank" rel="noreferrer">
                  <code className="mono">proxy/worker.js</code>
                </a>{" "}
                in this repo, hosted on Cloudflare Workers — that rewrites the request id to an
                integer, forwards to Bradbury, and restores the original id on the way back. The
                wallet still signs locally; the relay never sees a key, only the request envelope.
                The dapp adds Bradbury to the wallet with this relay as its RPC, so writes work out
                of the box.
              </p>
            </div>

            <div className="cfg-block">
              <div style={{ marginBottom: 14 }}>
                <span className="k" style={{ fontSize: 12 }}>Add Bradbury to your wallet</span>
                <span className="v" style={{ marginLeft: 10 }}>— press copy on each field, or copy the whole config.</span>
              </div>
              <CopyField label="Network name" value={CHAIN_PARAMS.chainName} />
              <CopyField label="RPC URL" value={RPC_PROXY} />
              <CopyField label="RPC (read-only)" value={RPC_DIRECT} />
              <CopyField label="Chain ID" value={String(CHAIN_ID)} />
              <CopyField label="Symbol" value="GEN" />
              <CopyField label="Explorer" value={EXPLORER} />
              <div className="cfg-actions">
                <CopyJson />
                <a className="btn btn-sm" href={FAUCET} target="_blank" rel="noreferrer">Test GEN faucet</a>
              </div>
              <p className="note" style={{ marginTop: 12 }}>
                Or just click <strong>Connect wallet</strong> above — the app adds and switches the
                network for you. No Snap, no extra extension.
              </p>
            </div>
          </div>

          <div className="net-cell">
            <div className="eyebrow" style={{ marginBottom: 18 }}>If a write fails</div>
            <div className="fail-list">
              {FAILURES.map((f) => (
                <div className={`fail-row fail-${f.chip}`} key={f.tag}>
                  <span className={`chip chip-${f.chip}`}>{f.tag}</span>
                  <div>
                    <div className="fail-title">{f.title}</div>
                    <div className="fail-body">{f.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
