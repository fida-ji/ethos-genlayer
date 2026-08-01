import { txUrl } from "../config.js";

export function VerdictChip({ verdict, active, status }) {
  if (status === "revoked") return <span className="chip chip-struck">Revoked</span>;
  if (verdict === "violation") return <span className="chip chip-struck">Struck</span>;
  if (verdict === "compliant") return <span className="chip chip-upheld">Upheld</span>;
  return <span className="chip chip-neutral">Awaiting audit</span>;
}

export function SeverityMeter({ severity }) {
  const n = Math.max(0, Math.min(10, Number(severity) || 0));
  const violation = n >= 7;
  return (
    <span className="sev" title={`Severity ${n}/10`}>
      {Array.from({ length: 10 }).map((_, i) => (
        <i key={i} className={i < n ? (violation ? "on-hi" : "on-lo") : ""} />
      ))}
    </span>
  );
}

// Live transaction lifecycle: pending spinner, phase text, clickable explorer link.
export function TxStatus({ tx }) {
  if (!tx) return null;
  const { phase, label, hash, error, errorInfo, verdict } = tx;
  const cls = error ? "is-err" : phase === "accepted" ? "is-ok" : "";
  const pending = phase === "submitting" || phase === "pending";
  return (
    <div className={`tx ${cls}`}>
      {pending ? <span className="spinner" /> : null}
      <div className="tx-body">
        <div className="tx-phase">
          {error ? "Transaction failed" : label}
          {verdict && !error ? (
            <span
              className={`stamp ${verdict === "violation" ? "stamp-struck" : "stamp-upheld"}`}
              style={{ marginLeft: 14, fontSize: 15, display: "inline-block" }}
            >
              {verdict === "violation" ? "Struck" : "Upheld"}
            </span>
          ) : null}
        </div>
        {error ? (
          <div className="tx-sub">
            {String(error).slice(0, 200)}
            <div className="tx-explain">
              <div className="tx-explain-title">{errorInfo?.title || "The transaction did not go through"}</div>
              {errorInfo?.body ? <div className="tx-explain-body">{errorInfo.body}</div> : null}
            </div>
          </div>
        ) : null}
        {hash ? (
          <div className="tx-sub">
            <a href={txUrl(hash)} target="_blank" rel="noreferrer">
              {hash.slice(0, 18)}… view on explorer
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
