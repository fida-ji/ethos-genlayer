# Ethos

**A court of record for AI personas — trustless, subjective brand enforcement on GenLayer.**

An expert licenses their voice to an AI agent. The moment they do, they lose control of how that voice behaves: a licensed agent goes condescending, fear-based, or off character, and the reputational damage lands on the expert, not the operator who ran it.

"Off brand" is subjective, so ordinary code cannot catch it. Keyword filters miss tone. Platform moderation covers safety, not brand alignment. A normal smart contract can check whether an API is up, but it cannot read a paragraph and rule on whether it broke someone's voice.

Ethos makes that judgment enforceable. An expert publishes an **Ethos Manifest** — a plain-language rubric of tone, voice, and hard boundaries. A licensee posts a security deposit in native GEN. Anyone submits evidence (recent agent outputs) for audit. GenLayer validators each run an LLM over the manifest and the evidence, reach consensus on a verdict and a severity score, and a confirmed violation deterministically slashes the deposit, pays the expert and the protocol, and revokes the license once a strike threshold is reached.

## Live on Testnet Bradbury

| | |
|---|---|
| Network | GenLayer Testnet Bradbury (chain id 4221) |
| Contract | [`0x3Be3c65Ef4E1755D878dD48c39D150De34a4335a`](https://explorer-bradbury.genlayer.com/contracts/0x3Be3c65Ef4E1755D878dD48c39D150De34a4335a) |
| Deploy transaction | [`0x4024dc47…aa121f`](https://explorer-bradbury.genlayer.com/tx/0x4024dc4779854d79556228947f45d17bcaca973c8a407691c6e5444f55aa121f) |
| Explorer | https://explorer-bradbury.genlayer.com |
| Faucet | https://testnet-faucet.genlayer.foundation |

The frontend reads every license, verdict, and slashed amount straight from the contract. Nothing on the page is hardcoded beyond the contract address and deploy transaction above.

## How enforcement works

Ethos separates the one decision that requires consensus from the settlement that follows deterministically.

1. **Register.** The expert publishes an Ethos Manifest. It is stored on chain as the standard the persona is held to.
2. **Deposit.** The licensee funds a security deposit in native GEN — the amount at risk if the agent goes off brand.
3. **Audit.** Anyone submits evidence. A leader validator scores it against the manifest; other validators independently re-score. They must agree on the verdict and on a severity within tolerance before it counts.
4. **Settle.** A confirmed violation is deterministic from there: 33% of the remaining deposit is slashed, split into a protocol fee and expert compensation (both accrue as claimable balances), a strike is recorded, and the license is revoked once the strike threshold is reached. Compliant audits change nothing but the record.

### Why GenLayer

The verdict is the only part that needs consensus, and it is exactly the part a deterministic chain cannot produce. GenLayer validators each run an LLM over the same manifest and evidence, then agree on the result under an equivalence rule. Slashing, fees, and revocation run afterward as plain arithmetic, so money only ever moves after the network agreed on the decision.

The consensus logic lives in the `audit` method. It uses a custom leader/validator pair (`gl.vm.run_nondet_unsafe`):

- The leader calls `gl.nondet.exec_prompt` with `response_format="json"`, parses a `severity` (0–10), and derives `violated = severity >= 7` so leader and validators apply one rule.
- Each validator re-runs the judgment independently and agrees only if the binary verdict matches **and** the severity is within ±2. Rationale wording may differ freely.
- Leader failures are classified: deterministic business errors (`[EXPECTED]`) must match exactly; malformed model output (`[LLM_ERROR]`) forces leader rotation.

This is comparative, field-level validation — not a check that the leader merely returned well-formed JSON.

## Seeded cases

Four full lifecycles were run on chain with real validator consensus:

| License | Verdict | Severity | Outcome |
|---|---|---|---|
| nutrition-vega | compliant | 0 | active, nothing slashed |
| security-atlas | violation | 10 | revoked, 0.33 GEN slashed |
| coach-maren | violation | 10 | one strike of three, 0.33 GEN slashed |
| tutor-lumen | compliant | 0 | active, nothing slashed |

Each verdict was produced by validators running an LLM, not by the frontend. The site reads them straight from the contract.

## Tech stack

- **Contract** — a single GenVM Intelligent Contract in Python (`contracts/ethos.py`), runner version pinned in the header. No `test`/`latest` aliases.
- **Consensus** — GenLayer Optimistic Democracy with a custom equivalence principle on the `audit` method.
- **Tests** — direct-mode tests with `genlayer-test` (`tests/direct/`), covering registration, deposits, compliant and violating audits, revocation, the claim flow, and the validator agreement/disagreement paths.
- **Deploy & seed** — Node scripts using `genlayer-js` (`scripts/`): `deploy.mjs`, `seed.mjs` (resumable), `verify.mjs` (live state read).
- **Frontend** — React 18 + Vite + `genlayer-js`, plain CSS (`app/`). Reads need no wallet; writes connect a wallet and switch it to Bradbury directly (no MetaMask Snaps). Live transaction status shows a pending spinner, phase text, a clickable explorer link, and a verdict stamp.

## Project layout

```
contracts/ethos.py       Intelligent Contract (GenVM, Python)
tests/direct/            direct-mode tests (pytest + genlayer-test)
scripts/                 deploy.mjs, seed.mjs, verify.mjs, lib.mjs (genlayer-js)
app/                     React + Vite frontend
app/src/config.js        baked-in contract address + GenLayer constants
netlify.toml             Netlify build config (base = app)
firebase.json            Firebase Hosting config (SPA rewrite, public = app/dist)
.firebaserc              Firebase project alias
```

## Run the frontend

```bash
cd app
npm install
npm run dev      # local development
npm run build    # production build to app/dist
npm run preview  # preview the production build
```

The app ships with the deployed contract address baked in, so it works with no configuration. To point it at a different deployment, set `VITE_CONTRACT_ADDRESS` before building.

## Lint and test the contract

Requires Python 3.12+:

```bash
python3.12 -m venv .venv && . .venv/bin/activate
pip install genvm-linter genlayer-test
genvm-lint check contracts/ethos.py
pytest tests/direct/ -q
```

## Deploy and seed your own instance

Requires a funded Bradbury key in a repo-root `.env` (see `.env.example`):

```bash
cd scripts
npm install
node deploy.mjs    # deploys and verifies live via a get_config read
node seed.mjs      # seeds 4 example lifecycles (resumable)
node verify.mjs    # prints live state from the contract
```

The deploy script writes `deployment.json` (gitignored, regenerated per deploy) holding the contract address, deploy transaction, and deployer. `seed.mjs` and `verify.mjs` read the address from there.

## Contract interface

**Views** (free, no wallet): `get_config`, `get_stats`, `list_licenses`, `get_license`, `get_audits`, `get_accrued`.

**Writes** (require a wallet on Bradbury): `register_license`, `deposit_stake` (payable), `audit`, `claim`.

## Deploy the site

### Netlify

`netlify.toml` builds from `app/` and publishes `app/dist`. Optionally set `VITE_CONTRACT_ADDRESS` as a Netlify site environment variable to override the baked-in default. Do not put secrets in `netlify.toml`.

### Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only hosting
```

`firebase.json` is configured for a single-page app: it builds `app/` and serves `app/dist` with an SPA rewrite so every route resolves to `index.html`. Set `VITE_CONTRACT_ADDRESS` as a Firebase env var to override the baked-in default.

## Security notes

- The deploy and seed scripts read the funded key from `.env` via `process.env` only. It is never printed, logged, or committed. `.env` is gitignored.
- Evidence is submitted as text, so the contract fetches no external URLs — there is no off-chain fetch nondeterminism to reason about.
- Settlement is deterministic and runs only after validators agree on the verdict. Money never moves on a disputed decision.
- `deployment.json` is gitignored; it is regenerated per deploy and holds only public on-chain addresses.

## Links

- GenLayer documentation: https://docs.genlayer.com
- GenLayer explorer (Bradbury): https://explorer-bradbury.genlayer.com
- Test GEN faucet: https://testnet-faucet.genlayer.foundation
