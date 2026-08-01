import { useEffect, useState } from "react";
import { Seal } from "./Seal.jsx";
import { Docket } from "./components/Docket.jsx";
import { Console } from "./components/Console.jsx";
import { NetworkSection } from "./components/Network.jsx";
import { useWallet } from "./useWallet.js";
import { read } from "./genlayer.js";
import {
  CONTRACT_ADDRESS,
  EXPLORER,
  FAUCET,
  contractUrl,
  short,
  txUrl,
} from "./config.js";

const DEPLOY_TX = "0x4024dc4779854d79556228947f45d17bcaca973c8a407691c6e5444f55aa121f";
const REPO_URL = "https://github.com/fida-ji/ethos-genlayer";

function GitHubMark({ size = 18, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      role="img"
      aria-label="GitHub repository"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function Wallet({ wallet }) {
  if (!wallet.hasProvider) {
    return (
      <a className="btn btn-sm" href="https://metamask.io/download/" target="_blank" rel="noreferrer">
        Install a wallet
      </a>
    );
  }
  if (!wallet.address) {
    return (
      <button className="btn btn-sm btn-primary" onClick={wallet.connect} disabled={wallet.connecting}>
        {wallet.connecting ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }
  return (
    <div className="wallet">
      {!wallet.onRightChain ? (
        <button className="btn btn-sm" onClick={wallet.switchNetwork}>
          Switch to Bradbury
        </button>
      ) : null}
      <span className="addr-pill">
        <span className={`dot ${wallet.onRightChain ? "" : "warn"}`} />
        {short(wallet.address)}
      </span>
      <button className="btn btn-sm" onClick={wallet.disconnect}>
        Disconnect
      </button>
    </div>
  );
}

function Stats() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let alive = true;
    read("get_stats", [])
      .then((s) => alive && setStats(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const items = [
    ["Licenses", stats?.licenses],
    ["Audits run", stats?.audits],
    ["Violations", stats?.violations],
  ];
  return (
    <div className="grid-3">
      {items.map(([label, v]) => (
        <div key={label}>
          <div className="stat-num mono">{v ?? "—"}</div>
          <div className="stat-label">{label}</div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const wallet = useWallet();

  return (
    <>
      {wallet.address && !wallet.onRightChain ? (
        <div className="banner">
          Your wallet is on the wrong network.
          <button className="btn btn-sm" onClick={wallet.switchNetwork}>
            Switch to Bradbury
          </button>
        </div>
      ) : null}

      <header className="masthead">
        <div className="wrap masthead-inner">
          <div className="brand">
            <Seal size={34} className="brand-mark" />
            <span className="brand-name">Ethos</span>
            <span className="brand-tag">Persona Licensing Court</span>
          </div>
          <nav className="nav">
            <a href="#how">How it works</a>
            <a href="#docket">Live docket</a>
            <a href="#console">Console</a>
            <a href="#network">Network</a>
            <a href="#build">Build</a>
          </nav>
          <div className="nav-actions">
            <a
              className="icon-link"
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              title="Source on GitHub"
              aria-label="Source on GitHub"
            >
              <GitHubMark size={18} />
            </a>
            <Wallet wallet={wallet} />
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="wrap hero">
        <div className="hero-grid">
          <div>
            <div className="eyebrow">Trustless subjective enforcement</div>
            <h1>
              A court of record for <em>AI personas</em>.
            </h1>
            <p className="hero-lede">
              Experts license their voice to AI agents, then lose control of how it sounds. Ethos
              holds a deposit against a plain-language manifest. When an agent goes off brand,
              GenLayer validators judge the evidence, agree on a verdict, and slash the deposit on
              chain.
            </p>
            <div className="hero-cta">
              <a className="btn btn-primary" href="#console">
                Open the console
              </a>
              <a className="btn" href="#how">
                How enforcement works
              </a>
            </div>
            <div className="tag-list">
              <span className="tag">GenLayer Intelligent Contract</span>
              <span className="tag">Testnet Bradbury</span>
              <span className="tag">Python / GenVM</span>
            </div>
          </div>
          <div className="hero-seal">
            <Seal size={360} />
          </div>
        </div>
      </section>

      {/* PROBLEM / WHAT IT IS */}
      <section className="section" id="what">
        <div className="wrap doc-grid">
          <div>
            <div className="eyebrow">The problem</div>
            <h2 className="lead">Off brand is subjective, so code cannot catch it.</h2>
          </div>
          <div className="prose">
            <p>
              An expert who licenses their AI twin is exposed to a reputation rugpull. The licensed
              agent says something condescending, fear-based, or off character, and the damage lands
              on the expert, not the operator.
            </p>
            <p>
              Keyword filters miss tone. Platform moderation only covers safety, not brand
              alignment. A normal smart contract can check whether an API is up, but it cannot read
              a paragraph and decide whether it broke someone's voice.
            </p>
            <p>
              <strong>Ethos makes the judgment enforceable.</strong> The expert writes an Ethos
              Manifest. The licensee posts a deposit. Anyone can submit evidence for audit. The
              contract owns one decision that no single party controls: did this output breach the
              manifest?
            </p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section" id="how">
        <div className="wrap">
          <div className="eyebrow">How enforcement works</div>
          <h2 className="lead" style={{ marginBottom: 34 }}>
            One consensus decision, then deterministic settlement.
          </h2>
          <div className="steps">
            {[
              [
                "Register",
                "The expert publishes an Ethos Manifest: a plain-language rubric of tone, voice, and hard boundaries. It is stored on chain as the standard the persona is held to.",
              ],
              [
                "Deposit",
                "The licensee funds a security deposit in native GEN. It is the amount at risk if the agent goes off brand, held by the contract until the license ends.",
              ],
              [
                "Audit",
                "Anyone submits evidence (recent agent outputs). A leader validator scores it against the manifest; other validators independently re-score. They must agree on the verdict and a severity within tolerance before it counts.",
              ],
              [
                "Settle",
                "A confirmed violation is deterministic from there: the deposit is slashed, a protocol fee and expert compensation accrue, a strike is recorded, and the license is revoked once the threshold is reached.",
              ],
            ].map(([h, p], i) => (
              <div className="step" key={h}>
                <div className="step-n mono">{String(i + 1).padStart(2, "0")}</div>
                <div>
                  <h4>{h}</h4>
                  <p>{p}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="divider-note">
            <span>Why GenLayer</span>
          </div>
          <p className="prose" style={{ marginTop: 12 }}>
            The verdict is the only part that needs consensus, and it is exactly the part a
            deterministic chain cannot produce. GenLayer validators each run an LLM over the same
            manifest and evidence, then agree on the result under an equivalence rule. Slashing,
            fees, and revocation run afterward as plain arithmetic, so the money always follows a
            decision the network agreed on.
          </p>
        </div>
      </section>

      {/* LIVE STATS + DOCKET */}
      <section className="section" id="docket">
        <div className="wrap">
          <div className="eyebrow">Live from the contract</div>
          <h2 className="lead" style={{ marginBottom: 28 }}>
            The docket, read straight from Bradbury.
          </h2>
          <Stats />
          <p className="prose" style={{ margin: "26px 0" }}>
            These are real licenses seeded on chain. Each verdict below was produced by validators
            running an LLM over the manifest and evidence, not by this page. Open any record to read
            the audit trail and the exact amounts slashed.
          </p>
          <Docket />
        </div>
      </section>

      {/* CONSOLE */}
      <section className="section" id="console">
        <div className="wrap">
          <div className="eyebrow">Interactive console</div>
          <h2 className="lead" style={{ marginBottom: 12 }}>
            Read the contract, or run the full lifecycle yourself.
          </h2>
          <p className="prose" style={{ marginBottom: 28 }}>
            Reads are free and need no wallet. Writes prompt your wallet and switch it to Bradbury
            first. Submitting an audit is a real transaction: validators reach consensus on the
            verdict before anything is slashed, so it takes longer than a normal write.
          </p>
          <Console wallet={wallet} />
          {wallet.error ? (
            <p className="note" style={{ marginTop: 12 }}>
              {wallet.error}
            </p>
          ) : null}
          <p className="note" style={{ marginTop: 16 }}>
            Need test GEN to write? Claim from the{" "}
            <a href={FAUCET} target="_blank" rel="noreferrer">
              Bradbury faucet
            </a>
            . If you previously added Bradbury to your wallet with a different
            RPC, remove that network entry and reconnect so the correct RPC is
            used; otherwise writes may fail.
          </p>
        </div>
      </section>

      {/* NETWORK & RPC PRIMER */}
      <NetworkSection />

      {/* BUILD / DEVELOPER */}
      <section className="section" id="build">
        <div className="wrap doc-grid">
          <div>
            <div className="eyebrow">For developers</div>
            <h2 className="lead">Everything runs against one deployed contract.</h2>
          </div>
          <div className="prose">
            <p>
              Ethos is a single GenVM Intelligent Contract written in Python. The consensus-critical
              method is <code className="mono">audit</code>, which uses a custom leader/validator
              pair: the leader proposes a severity and verdict, and each validator re-runs the
              judgment and agrees only if the verdict matches and the severity is within tolerance.
            </p>
            <div className="panel panel-pad" style={{ marginTop: 8 }}>
              <div className="case-meta" style={{ gap: 22 }}>
                <div style={{ minWidth: "100%" }}>
                  <span className="k">Contract address</span>
                  <span className="v mono">
                    <a href={contractUrl} target="_blank" rel="noreferrer">
                      {CONTRACT_ADDRESS}
                    </a>
                  </span>
                </div>
                <div style={{ minWidth: "100%" }}>
                  <span className="k">Deploy transaction</span>
                  <span className="v mono">
                    <a href={txUrl(DEPLOY_TX)} target="_blank" rel="noreferrer">
                      {short(DEPLOY_TX)}
                    </a>
                  </span>
                </div>
                <div>
                  <span className="k">Network</span>
                  <span className="v mono">Testnet Bradbury · 4221</span>
                </div>
                <div>
                  <span className="k">Explorer</span>
                  <span className="v mono">
                    <a href={EXPLORER} target="_blank" rel="noreferrer">
                      explorer-bradbury
                    </a>
                  </span>
                </div>
              </div>
            </div>
            <p style={{ marginTop: 18 }}>
              Views (<code className="mono">get_config</code>, <code className="mono">get_stats</code>,{" "}
              <code className="mono">list_licenses</code>, <code className="mono">get_license</code>,{" "}
              <code className="mono">get_audits</code>, <code className="mono">get_accrued</code>) are
              free to call. State changes go through <code className="mono">register_license</code>,{" "}
              <code className="mono">deposit_stake</code> (payable), <code className="mono">audit</code>, and{" "}
              <code className="mono">claim</code>.
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="wrap">
          <div className="footer-grid">
            <div style={{ maxWidth: 320 }}>
              <div className="brand" style={{ marginBottom: 14 }}>
                <Seal size={40} className="brand-mark" />
                <span className="brand-name">Ethos</span>
              </div>
              <p className="note" style={{ lineHeight: 1.7 }}>
                A subjective firewall for licensed AI personas, settled on GenLayer.
              </p>
            </div>
            <div className="footer-links">
              <div className="footer-col">
                <h5>Contract</h5>
                <a href={contractUrl} target="_blank" rel="noreferrer">
                  On explorer
                </a>
                <a href={txUrl(DEPLOY_TX)} target="_blank" rel="noreferrer">
                  Deploy tx
                </a>
                <a href={FAUCET} target="_blank" rel="noreferrer">
                  Bradbury faucet
                </a>
              </div>
              <div className="footer-col">
                <h5>GenLayer</h5>
                <a href="https://docs.genlayer.com" target="_blank" rel="noreferrer">
                  Documentation
                </a>
                <a href="https://explorer-bradbury.genlayer.com" target="_blank" rel="noreferrer">
                  Explorer
                </a>
                <a href="https://github.com/genlayerlabs" target="_blank" rel="noreferrer">
                  GitHub
                </a>
              </div>
              <div className="footer-col">
                <h5>Source</h5>
                <a href={REPO_URL} target="_blank" rel="noreferrer">
                  <GitHubMark size={14} /> ethos-genlayer
                </a>
              </div>
              <div className="footer-col">
                <h5>On this page</h5>
                <a href="#how">How it works</a>
                <a href="#docket">Live docket</a>
                <a href="#console">Console</a>
              </div>
            </div>
          </div>
          <div className="colophon">
            <span>Ethos · built on GenLayer Testnet Bradbury</span>
            <span className="mono">{short(CONTRACT_ADDRESS)}</span>
          </div>
        </div>
      </footer>
    </>
  );
}
