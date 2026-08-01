# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# Ethos - trustless subjective enforcement of AI persona licensing.
#
# An expert publishes an "Ethos Manifest": a plain-language rubric describing the
# tone, voice, and hard boundaries their licensed AI persona must respect. A
# licensee posts a security deposit and operates an agent under that persona.
# Anyone can submit evidence (recent agent outputs) for audit. GenLayer validators
# independently judge whether the evidence violates the manifest and reach
# consensus on a binary verdict plus a severity score. A confirmed violation
# deterministically slashes the deposit, credits the expert and the protocol, and
# revokes the license once the strike threshold is reached.
#
# Consensus-critical decision (owned by this contract):
#   "Does this evidence violate the expert's Ethos Manifest?"
# Everything financial (slashing, fees, revocation) is deterministic settlement
# that runs only after validators agree on that decision.

from genlayer import *

import json
import typing
from dataclasses import dataclass
from datetime import datetime, timezone

# Error prefixes let validators classify failures during consensus.
ERROR_EXPECTED = "[EXPECTED]"  # business logic, deterministic, must match exactly
ERROR_LLM = "[LLM_ERROR]"      # malformed model output, force leader rotation

# Economic constants (basis points, 10000 = 100%).
BPS_DENOMINATOR = 10000
SLASH_BPS = 3300               # each confirmed violation slashes 33% of remaining stake
VIOLATION_SEVERITY = 7         # severity >= this is treated as a violation
SEVERITY_TOLERANCE = 2         # validators accept the leader if severity is within +/- 2
ATTO = 1000000000000000000     # 1 GEN expressed in atto-GEN (10**18)


@allow_storage
@dataclass
class License:
    id: str
    expert: Address            # owns the persona / brand voice
    licensee: Address          # operates the licensed agent, posts the deposit
    persona: str               # short human label, e.g. "Dr. Vega - Clinical Nutrition"
    manifest: str              # the Ethos Manifest rubric (plain language)
    stake_atto: u256           # remaining security deposit, in atto-GEN
    slashed_atto: u256         # cumulative amount slashed
    strike_threshold: u256     # violations tolerated before revocation
    strikes: u256              # confirmed violations so far
    audit_count: u256          # total audits run against this license
    active: bool               # false once revoked
    status: str                # "active" or "revoked"
    last_severity: u256        # severity of the most recent audit (0-10)
    last_verdict: str          # "compliant" or "violation"
    last_rationale: str        # short reason from the most recent audit
    created_at: str            # ISO 8601 (transaction time)
    updated_at: str            # ISO 8601 (transaction time)


class Ethos(gl.Contract):
    owner: Address
    fee_recipient: Address
    fee_bps: u256
    license_total: u256
    audit_total: u256
    violation_total: u256
    licenses: TreeMap[str, License]
    license_ids: DynArray[str]
    audits: TreeMap[str, DynArray[str]]     # license_id -> list of JSON audit records
    accrued: TreeMap[Address, u256]         # claimable atto-GEN (experts + protocol fee)

    def __init__(self, fee_recipient: str, fee_bps: int):
        self.owner = gl.message.sender_address
        # Blank fee_recipient defaults to the deployer.
        if fee_recipient is None or len(fee_recipient) == 0:
            self.fee_recipient = gl.message.sender_address
        else:
            self.fee_recipient = Address(fee_recipient)
        capped = int(fee_bps)
        if capped < 0:
            capped = 0
        if capped > BPS_DENOMINATOR:
            capped = BPS_DENOMINATOR
        self.fee_bps = u256(capped)

    # ---------------------------------------------------------------- helpers

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _require_license(self, license_id: str) -> License:
        if license_id not in self.licenses:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Unknown license: {license_id}")
        return self.licenses[license_id]

    def _license_view(self, lic: License) -> dict:
        return {
            "id": lic.id,
            "expert": lic.expert.as_hex,
            "licensee": lic.licensee.as_hex,
            "persona": lic.persona,
            "manifest": lic.manifest,
            "stake_atto": str(lic.stake_atto),
            "slashed_atto": str(lic.slashed_atto),
            "strike_threshold": int(lic.strike_threshold),
            "strikes": int(lic.strikes),
            "audit_count": int(lic.audit_count),
            "active": lic.active,
            "status": lic.status,
            "last_severity": int(lic.last_severity),
            "last_verdict": lic.last_verdict,
            "last_rationale": lic.last_rationale,
            "created_at": lic.created_at,
            "updated_at": lic.updated_at,
        }

    # ---------------------------------------------------------------- writes

    @gl.public.write
    def register_license(
        self,
        license_id: str,
        expert: str,
        licensee: str,
        persona: str,
        manifest: str,
        strike_threshold: int,
    ) -> None:
        """Publish an Ethos Manifest and open a license slot."""
        if len(license_id) == 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} license_id required")
        if license_id in self.licenses:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} License already exists: {license_id}")
        if len(manifest.strip()) < 20:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Manifest is too short to enforce")
        threshold = int(strike_threshold)
        if threshold < 1:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} strike_threshold must be >= 1")

        now = self._now()
        lic = License(
            id=license_id,
            expert=Address(expert),
            licensee=Address(licensee),
            persona=persona,
            manifest=manifest,
            stake_atto=u256(0),
            slashed_atto=u256(0),
            strike_threshold=u256(threshold),
            strikes=u256(0),
            audit_count=u256(0),
            active=True,
            status="active",
            last_severity=u256(0),
            last_verdict="none",
            last_rationale="",
            created_at=now,
            updated_at=now,
        )
        self.licenses[license_id] = lic
        self.license_ids.append(license_id)
        self.license_total += u256(1)

    @gl.public.write.min_gas(leader=15, validator=8).payable
    def deposit_stake(self, license_id: str) -> None:
        """Fund a license's security deposit with native GEN. Explicit gas floor
        is set via min_gas so the payable transaction stays appealable."""
        lic = self._require_license(license_id)
        value = gl.message.value
        if value == 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} deposit_stake requires a non-zero value")
        lic.stake_atto += value
        lic.updated_at = self._now()

    @gl.public.write
    def audit(self, license_id: str, evidence: str) -> None:
        """Submit agent outputs as evidence and let validators judge them against
        the manifest. Confirmed violations slash the deposit and can revoke."""
        lic = self._require_license(license_id)
        if len(evidence.strip()) < 10:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Evidence is too short to audit")

        manifest = lic.manifest
        persona = lic.persona

        def leader_fn() -> dict:
            prompt = f"""You are an impartial brand-alignment auditor for a licensed AI persona.

PERSONA: {persona}

ETHOS MANIFEST (the tone, voice, and hard boundaries the persona must respect):
---
{manifest}
---

EVIDENCE (recent outputs produced by the licensed AI persona):
---
{evidence}
---

Judge only whether the EVIDENCE breaches the MANIFEST. Ignore spelling and formatting.
Return a JSON object with exactly these keys:
  "severity": integer 0-10 (0 = perfectly on-brand, 10 = severe breach),
  "rationale": string, at most 240 characters, citing the specific manifest rule.
A breach is any output that violates the manifest's tone, voice, or boundaries.
Respond with JSON only."""
            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            if not isinstance(raw, dict):
                raise gl.vm.UserError(f"{ERROR_LLM} model returned non-dict: {type(raw)}")
            severity = _parse_severity(raw)
            rationale = _parse_rationale(raw)
            # Derive the verdict from severity so leader and validators use one rule.
            violated = severity >= VIOLATION_SEVERITY
            return {"severity": severity, "violated": violated, "rationale": rationale}

        def validator_fn(leaders_res: gl.vm.Result) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return _handle_leader_error(leaders_res, leader_fn)
            mine = leader_fn()
            leader = leaders_res.calldata
            # Consensus requires agreement on the binary verdict and a severity
            # score within tolerance. Rationale wording may differ freely.
            if bool(leader["violated"]) != bool(mine["violated"]):
                return False
            if abs(int(leader["severity"]) - int(mine["severity"])) > SEVERITY_TOLERANCE:
                return False
            return True

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        # ---- deterministic settlement (runs only after consensus) ----
        severity = int(result["severity"])
        violated = bool(result["violated"])
        rationale = str(result["rationale"])[:240]
        now = self._now()

        lic.audit_count += u256(1)
        self.audit_total += u256(1)
        lic.last_severity = u256(severity)
        lic.last_rationale = rationale
        lic.last_verdict = "violation" if violated else "compliant"
        lic.updated_at = now

        slashed_now = 0
        fee_now = 0
        comp_now = 0
        revoked_now = False

        if violated and lic.active:
            lic.strikes += u256(1)
            self.violation_total += u256(1)
            slashed_now = int(lic.stake_atto) * SLASH_BPS // BPS_DENOMINATOR
            if slashed_now > 0:
                lic.stake_atto -= u256(slashed_now)
                lic.slashed_atto += u256(slashed_now)
                fee_now = slashed_now * int(self.fee_bps) // BPS_DENOMINATOR
                comp_now = slashed_now - fee_now
                if fee_now > 0:
                    self.accrued[self.fee_recipient] = (
                        self.accrued.get(self.fee_recipient, u256(0)) + u256(fee_now)
                    )
                if comp_now > 0:
                    self.accrued[lic.expert] = (
                        self.accrued.get(lic.expert, u256(0)) + u256(comp_now)
                    )
            if int(lic.strikes) >= int(lic.strike_threshold):
                lic.active = False
                lic.status = "revoked"
                revoked_now = True

        record = {
            "ts": now,
            "auditor": gl.message.sender_address.as_hex,
            "severity": severity,
            "verdict": "violation" if violated else "compliant",
            "rationale": rationale,
            "evidence": evidence[:600],
            "slashed_atto": str(slashed_now),
            "fee_atto": str(fee_now),
            "compensation_atto": str(comp_now),
            "revoked": revoked_now,
            "strike": int(lic.strikes),
        }
        self.audits.get_or_insert_default(license_id).append(json.dumps(record))

    @gl.public.write
    def claim(self) -> None:
        """Withdraw accrued compensation or protocol fees as native GEN."""
        sender = gl.message.sender_address
        amount = self.accrued.get(sender, u256(0))
        if amount == 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Nothing to claim")
        self.accrued[sender] = u256(0)
        gl.get_contract_at(sender).emit_transfer(value=amount, on="finalized")

    # ---------------------------------------------------------------- views

    @gl.public.view
    def get_config(self) -> dict:
        return {
            "owner": self.owner.as_hex,
            "fee_recipient": self.fee_recipient.as_hex,
            "fee_bps": int(self.fee_bps),
            "slash_bps": SLASH_BPS,
            "violation_severity": VIOLATION_SEVERITY,
            "severity_tolerance": SEVERITY_TOLERANCE,
        }

    @gl.public.view
    def get_stats(self) -> dict:
        return {
            "licenses": int(self.license_total),
            "audits": int(self.audit_total),
            "violations": int(self.violation_total),
        }

    @gl.public.view
    def get_license(self, license_id: str) -> dict:
        return self._license_view(self._require_license(license_id))

    @gl.public.view
    def list_licenses(self) -> list:
        out = []
        for lid in self.license_ids:
            out.append(self._license_view(self.licenses[lid]))
        return out

    @gl.public.view
    def get_audits(self, license_id: str) -> list:
        self._require_license(license_id)
        out = []
        if license_id in self.audits:
            for rec in self.audits[license_id]:
                out.append(json.loads(rec))
        return out

    @gl.public.view
    def get_accrued(self, address: str) -> str:
        return str(self.accrued.get(Address(address), u256(0)))


# -------------------------------------------------------------- module helpers

def _parse_severity(raw: dict) -> int:
    """Extract a 0-10 integer severity from an LLM response, tolerating aliases
    and stringified numbers."""
    value = raw.get("severity")
    if value is None:
        for alt in ("score", "rating", "level"):
            if alt in raw:
                value = raw[alt]
                break
    if value is None:
        raise gl.vm.UserError(f"{ERROR_LLM} missing 'severity'; keys={list(raw.keys())}")
    try:
        parsed = int(round(float(str(value).strip())))
    except (ValueError, TypeError):
        raise gl.vm.UserError(f"{ERROR_LLM} non-numeric severity: {value}")
    if parsed < 0:
        parsed = 0
    if parsed > 10:
        parsed = 10
    return parsed


def _parse_rationale(raw: dict) -> str:
    value = raw.get("rationale")
    if value is None:
        for alt in ("reason", "explanation", "analysis"):
            if alt in raw:
                value = raw[alt]
                break
    if value is None:
        value = ""
    return str(value)[:240]


def _handle_leader_error(leaders_res: gl.vm.Result, leader_fn: typing.Callable) -> bool:
    """Compare a failing leader against an independent validator run."""
    leader_msg = leaders_res.message if hasattr(leaders_res, "message") else ""
    try:
        leader_fn()
        return False  # leader failed but validator succeeded -> disagree
    except gl.vm.UserError as exc:
        validator_msg = exc.message if hasattr(exc, "message") else str(exc)
        # Deterministic business errors must match exactly.
        if validator_msg.startswith(ERROR_EXPECTED):
            return validator_msg == leader_msg
        # LLM misbehaviour: disagree to force a new leader.
        return False
    except Exception:
        return False
