import { useState } from "react";
import { read, write, ensureNetwork } from "../genlayer.js";
import { TxStatus } from "./ui.jsx";

const TABS = [
  { key: "read-license", label: "Read a license", kind: "read" },
  { key: "list", label: "All licenses", kind: "read" },
  { key: "stats", label: "Contract stats", kind: "read" },
  { key: "accrued", label: "Accrued balance", kind: "read" },
  { key: "register", label: "Register license", kind: "write" },
  { key: "deposit", label: "Deposit stake", kind: "write" },
  { key: "audit", label: "Submit for audit", kind: "write" },
  { key: "claim", label: "Claim payout", kind: "write" },
];

function toAtto(input) {
  const [whole, frac = ""] = String(input).trim().split(".");
  const fracPadded = (frac + "0".repeat(18)).slice(0, 18);
  return BigInt(whole || "0") * 10n ** 18n + BigInt(fracPadded || "0");
}

export function Console({ wallet }) {
  const [tab, setTab] = useState("read-license");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [tx, setTx] = useState(null);
  const [f, setF] = useState({
    id: "nutrition-vega",
    expert: "0x1111111111111111111111111111111111111111",
    licensee: wallet.address || "",
    persona: "",
    manifest: "",
    threshold: 3,
    amount: "0.5",
    evidence: "",
    address: wallet.address || "",
  });

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const active = TABS.find((t) => t.key === tab);
  const isWrite = active.kind === "write";
  const canWrite = wallet.address && wallet.client && wallet.onRightChain;

  async function runRead() {
    setBusy(true);
    setResult(null);
    try {
      let out;
      if (tab === "read-license") out = await read("get_license", [f.id]);
      else if (tab === "list") out = await read("list_licenses", []);
      else if (tab === "stats") out = await read("get_stats", []);
      else if (tab === "accrued")
        out = { address: f.address, accrued_atto: await read("get_accrued", [f.address]) };
      setResult(JSON.stringify(out, null, 2));
    } catch (e) {
      setResult("Error: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function runWrite() {
    if (!canWrite) return;
    setBusy(true);
    setTx({ phase: "submitting", label: "Awaiting wallet signature" });
    setResult(null);
    try {
      await ensureNetwork(wallet.client);
      const onPhase = (p) => setTx((prev) => ({ ...prev, ...p }));

      if (tab === "register") {
        await write(
          wallet.client,
          "register_license",
          [f.id, f.expert, f.licensee || wallet.address, f.persona, f.manifest, Number(f.threshold)],
          { onPhase }
        );
      } else if (tab === "deposit") {
        await write(wallet.client, "deposit_stake", [f.id], { value: toAtto(f.amount), onPhase });
      } else if (tab === "audit") {
        await write(wallet.client, "audit", [f.id, f.evidence], { onPhase });
        // Reflect the verdict the validators reached.
        const lic = await read("get_license", [f.id]);
        setTx((prev) => ({
          ...prev,
          phase: "accepted",
          label: "Verdict recorded",
          verdict: lic.last_verdict,
        }));
        setResult(JSON.stringify(lic, null, 2));
      } else if (tab === "claim") {
        await write(wallet.client, "claim", [], { onPhase });
      }
    } catch (e) {
      setTx((prev) => ({ ...(prev || {}), error: e?.shortMessage || e?.message || String(e) }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="console-grid">
      <div className="console-nav">
        <div className="note" style={{ padding: "4px 12px 8px", fontSize: 10.5, letterSpacing: "0.12em" }}>
          READ
        </div>
        {TABS.filter((t) => t.kind === "read").map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "active" : ""}
            onClick={() => {
              setTab(t.key);
              setResult(null);
              setTx(null);
            }}
          >
            {t.label}
          </button>
        ))}
        <div className="note" style={{ padding: "12px 12px 8px", fontSize: 10.5, letterSpacing: "0.12em" }}>
          WRITE
        </div>
        {TABS.filter((t) => t.kind === "write").map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "active" : ""}
            onClick={() => {
              setTab(t.key);
              setResult(null);
              setTx(null);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="console-main">
        {/* READ forms */}
        {tab === "read-license" && (
          <div className="field">
            <label>license id</label>
            <input value={f.id} onChange={set("id")} placeholder="nutrition-vega" />
          </div>
        )}
        {tab === "accrued" && (
          <div className="field">
            <label>address</label>
            <input value={f.address} onChange={set("address")} placeholder="0x…" />
            <div className="hint">Reads claimable atto-GEN for an expert or the protocol.</div>
          </div>
        )}
        {(tab === "list" || tab === "stats") && (
          <p className="prose" style={{ fontSize: 14 }}>
            {tab === "list"
              ? "Reads every registered license and its current verdict directly from the contract."
              : "Reads the running totals: licenses registered, audits run, violations confirmed."}
          </p>
        )}

        {/* WRITE forms */}
        {tab === "register" && (
          <>
            <div className="field">
              <label>license id</label>
              <input value={f.id} onChange={set("id")} placeholder="unique-slug" />
            </div>
            <div className="field">
              <label>persona label</label>
              <input value={f.persona} onChange={set("persona")} placeholder="Dr. Vega - Clinical Nutrition" />
            </div>
            <div className="field">
              <label>ethos manifest (the rubric validators enforce)</label>
              <textarea
                rows={4}
                value={f.manifest}
                onChange={set("manifest")}
                placeholder="Speak with calm, evidence-based authority. Never give an individual diagnosis. Never use fear or shame..."
              />
              <div className="hint">At least 20 characters. This plain-language text is what validators judge against.</div>
            </div>
            <div className="field">
              <label>expert address (persona owner)</label>
              <input value={f.expert} onChange={set("expert")} placeholder="0x…" />
            </div>
            <div className="field">
              <label>licensee address (agent operator)</label>
              <input value={f.licensee} onChange={set("licensee")} placeholder={wallet.address || "0x…"} />
            </div>
            <div className="field">
              <label>strike threshold</label>
              <input type="number" min="1" value={f.threshold} onChange={set("threshold")} />
              <div className="hint">Confirmed violations tolerated before the license is revoked.</div>
            </div>
          </>
        )}
        {tab === "deposit" && (
          <>
            <div className="field">
              <label>license id</label>
              <input value={f.id} onChange={set("id")} />
            </div>
            <div className="field">
              <label>amount (GEN)</label>
              <input value={f.amount} onChange={set("amount")} placeholder="0.5" />
              <div className="hint">Sent as native GEN with the payable transaction and held as the security deposit.</div>
            </div>
          </>
        )}
        {tab === "audit" && (
          <>
            <div className="field">
              <label>license id</label>
              <input value={f.id} onChange={set("id")} />
            </div>
            <div className="field">
              <label>evidence (recent agent outputs)</label>
              <textarea
                rows={5}
                value={f.evidence}
                onChange={set("evidence")}
                placeholder="Paste the licensed agent's recent output here. Validators judge it against the manifest."
              />
              <div className="hint">
                This submits a real transaction. Validators run an LLM independently and reach consensus on the verdict before any slashing.
              </div>
            </div>
          </>
        )}
        {tab === "claim" && (
          <p className="prose" style={{ fontSize: 14 }}>
            Withdraws any accrued compensation (for experts) or protocol fees to the connected wallet as native GEN.
          </p>
        )}

        {/* actions */}
        <div style={{ marginTop: 8 }}>
          {isWrite ? (
            !wallet.address ? (
              <button className="btn btn-primary" onClick={wallet.connect}>
                Connect wallet to write
              </button>
            ) : !wallet.onRightChain ? (
              <button className="btn btn-primary" onClick={wallet.switchNetwork}>
                Switch to Bradbury
              </button>
            ) : (
              <button className="btn btn-primary" onClick={runWrite} disabled={busy}>
                {busy ? "Working…" : active.label}
              </button>
            )
          ) : (
            <button className="btn btn-primary" onClick={runRead} disabled={busy}>
              {busy ? "Reading…" : "Run read call"}
            </button>
          )}
        </div>

        <TxStatus tx={tx} />
        {result ? <div className="result">{result}</div> : null}
      </div>
    </div>
  );
}
