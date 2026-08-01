import { useEffect, useState } from "react";
import { read } from "../genlayer.js";
import { gen, short, addrUrl } from "../config.js";
import { VerdictChip, SeverityMeter } from "./ui.jsx";

function Case({ lic }) {
  const [open, setOpen] = useState(false);
  const [audits, setAudits] = useState(null);
  const [loading, setLoading] = useState(false);

  const cls =
    lic.status === "revoked"
      ? "is-revoked"
      : lic.last_verdict === "violation"
        ? "is-struck"
        : lic.last_verdict === "compliant"
          ? "is-upheld"
          : "";

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && audits === null) {
      setLoading(true);
      try {
        setAudits(await read("get_audits", [lic.id]));
      } catch {
        setAudits([]);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className={`case ${cls}`}>
      <div className="case-head">
        <div>
          <div className="case-persona">{lic.persona}</div>
          <div className="case-id mono">{lic.id}</div>
        </div>
        <VerdictChip verdict={lic.last_verdict} active={lic.active} status={lic.status} />
      </div>

      <p className="case-manifest">{lic.manifest}</p>

      <div className="case-meta">
        <div>
          <span className="k">Deposit held</span>
          <span className="v mono">{gen(lic.stake_atto)} GEN</span>
        </div>
        <div>
          <span className="k">Slashed</span>
          <span className="v mono">{gen(lic.slashed_atto)} GEN</span>
        </div>
        <div>
          <span className="k">Strikes</span>
          <span className="v mono">
            {lic.strikes} / {lic.strike_threshold}
          </span>
        </div>
        <div>
          <span className="k">Last severity</span>
          <span className="v">
            <SeverityMeter severity={lic.last_severity} />
          </span>
        </div>
        <div>
          <span className="k">Expert</span>
          <span className="v mono">
            <a href={addrUrl(lic.expert)} target="_blank" rel="noreferrer">
              {short(lic.expert)}
            </a>
          </span>
        </div>
      </div>

      {lic.last_rationale ? (
        <div className="case-rationale">Validators wrote: “{lic.last_rationale}”</div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <button className="btn btn-sm" onClick={toggle}>
          {open ? "Hide audit record" : `Audit record (${lic.audit_count})`}
        </button>
      </div>

      {open ? (
        <div style={{ marginTop: 14 }}>
          {loading ? (
            <div className="note">Reading audit trail from chain…</div>
          ) : audits && audits.length ? (
            audits.map((a, i) => (
              <div key={i} className="result" style={{ marginTop: 10 }}>
                {`verdict:  ${a.verdict}\nseverity: ${a.severity}/10\nslashed:  ${gen(a.slashed_atto)} GEN  (fee ${gen(a.fee_atto)} + expert ${gen(a.compensation_atto)})\nrevoked:  ${a.revoked}\nwhen:     ${a.ts}\n\nrationale: ${a.rationale}\n\nevidence: ${a.evidence}`}
              </div>
            ))
          ) : (
            <div className="note">No audits recorded yet.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function Docket() {
  const [licenses, setLicenses] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    // Single read on mount (no burst). Audits load lazily per case.
    read("list_licenses", [])
      .then((rows) => alive && setLicenses(rows))
      .catch((e) => alive && setErr(e?.message || "Failed to read licenses"));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="docket">
      {licenses === null && !err ? (
        <div className="note">Reading the live docket from Bradbury…</div>
      ) : null}
      {err ? <div className="note">Could not reach the contract: {err}</div> : null}
      {licenses?.length === 0 ? <div className="note">No licenses registered yet.</div> : null}
      {licenses?.map((lic) => (
        <Case key={lic.id} lic={lic} />
      ))}
    </div>
  );
}
