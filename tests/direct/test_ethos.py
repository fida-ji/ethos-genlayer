"""Direct-mode tests for the Ethos contract.

Direct mode runs the leader path in-memory (~ms). LLM calls are mocked. The final
test also exercises the validator/consensus function via run_validator.
"""

import json

from conftest import mock_audit, deploy, hx

MANIFEST = (
    "Speak with calm, evidence-based authority. Never give individual medical "
    "diagnoses. Never use fear or shame to pressure a reader. Stay warm and plain."
)
ONE_GEN = 10**18


def _register(contract, direct_vm, owner, alice, bob, threshold=3):
    direct_vm.sender = owner
    contract.register_license(
        "lic-1", hx(alice), hx(bob), "Dr. Vega - Clinical Nutrition", MANIFEST, threshold
    )


def test_register_and_read(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_deploy)
    _register(contract, direct_vm, direct_owner, direct_alice, direct_bob)

    lic = contract.get_license("lic-1")
    assert lic["id"] == "lic-1"
    assert lic["persona"] == "Dr. Vega - Clinical Nutrition"
    assert lic["active"] is True
    assert lic["strikes"] == 0
    assert lic["strike_threshold"] == 3
    assert contract.get_stats()["licenses"] == 1

    listed = contract.list_licenses()
    assert len(listed) == 1 and listed[0]["id"] == "lic-1"


def test_config_defaults_to_deployer(direct_vm, direct_deploy, direct_owner):
    direct_vm.sender = direct_owner
    contract = deploy(direct_deploy, fee_recipient="", fee_bps=250)
    cfg = contract.get_config()
    assert cfg["fee_recipient"].lower() == hx(direct_owner)
    assert cfg["fee_bps"] == 250
    assert cfg["owner"].lower() == hx(direct_owner)


def test_deposit_requires_value(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_deploy)
    _register(contract, direct_vm, direct_owner, direct_alice, direct_bob)
    direct_vm.sender = direct_bob
    direct_vm.value = 0
    with direct_vm.expect_revert("requires a non-zero value"):
        contract.deposit_stake("lic-1")


def test_deposit_accumulates(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_deploy)
    _register(contract, direct_vm, direct_owner, direct_alice, direct_bob)
    direct_vm.sender = direct_bob
    direct_vm.value = 2 * ONE_GEN
    contract.deposit_stake("lic-1")
    assert contract.get_license("lic-1")["stake_atto"] == str(2 * ONE_GEN)
    direct_vm.value = ONE_GEN
    contract.deposit_stake("lic-1")
    assert contract.get_license("lic-1")["stake_atto"] == str(3 * ONE_GEN)


def test_compliant_audit_does_not_slash(
    direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob
):
    contract = deploy(direct_deploy)
    _register(contract, direct_vm, direct_owner, direct_alice, direct_bob)
    direct_vm.sender = direct_bob
    direct_vm.value = 10 * ONE_GEN
    contract.deposit_stake("lic-1")

    mock_audit(direct_vm, severity=2, rationale="on brand")
    direct_vm.value = 0
    contract.audit("lic-1", "Here is a balanced, evidence-based note on hydration.")

    lic = contract.get_license("lic-1")
    assert lic["last_verdict"] == "compliant"
    assert lic["strikes"] == 0
    assert lic["stake_atto"] == str(10 * ONE_GEN)
    assert lic["active"] is True
    assert contract.get_stats()["violations"] == 0


def test_violation_slashes_and_splits_fee(
    direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob
):
    contract = deploy(direct_deploy, fee_recipient="", fee_bps=100)  # 1% protocol fee
    _register(contract, direct_vm, direct_owner, direct_alice, direct_bob)
    direct_vm.sender = direct_bob
    direct_vm.value = 100 * ONE_GEN
    contract.deposit_stake("lic-1")

    mock_audit(direct_vm, severity=9, rationale="used fear-based pressure")
    direct_vm.value = 0
    contract.audit("lic-1", "If you skip this supplement you will certainly get sick and suffer.")

    lic = contract.get_license("lic-1")
    assert lic["last_verdict"] == "violation"
    assert lic["strikes"] == 1
    # 33% of 100 GEN slashed = 33 GEN; remaining 67 GEN.
    slashed = 100 * ONE_GEN * 3300 // 10000
    assert lic["slashed_atto"] == str(slashed)
    assert lic["stake_atto"] == str(100 * ONE_GEN - slashed)
    # fee = 1% of slashed to protocol (deployer), remainder to expert (alice).
    fee = slashed * 100 // 10000
    assert contract.get_accrued(hx(direct_owner)) == str(fee)
    assert contract.get_accrued(hx(direct_alice)) == str(slashed - fee)
    assert contract.get_stats()["violations"] == 1


def test_revocation_after_threshold(
    direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob
):
    contract = deploy(direct_deploy)
    _register(contract, direct_vm, direct_owner, direct_alice, direct_bob, threshold=2)
    direct_vm.sender = direct_bob
    direct_vm.value = 100 * ONE_GEN
    contract.deposit_stake("lic-1")

    mock_audit(direct_vm, severity=8)
    direct_vm.value = 0
    contract.audit("lic-1", "First off-brand response that shames the reader.")
    assert contract.get_license("lic-1")["active"] is True

    contract.audit("lic-1", "Second off-brand response that shames the reader.")
    lic = contract.get_license("lic-1")
    assert lic["active"] is False
    assert lic["status"] == "revoked"
    assert lic["strikes"] == 2

    audits = contract.get_audits("lic-1")
    assert len(audits) == 2
    assert audits[-1]["revoked"] is True


def test_unknown_license_reverts(direct_vm, direct_deploy, direct_owner):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_owner
    with direct_vm.expect_revert("Unknown license"):
        contract.get_license("nope")


def test_short_manifest_reverts(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_owner
    with direct_vm.expect_revert("too short"):
        contract.register_license(
            "lic-x", hx(direct_alice), hx(direct_bob), "P", "too short", 3
        )


def test_duplicate_license_reverts(
    direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob
):
    contract = deploy(direct_deploy)
    _register(contract, direct_vm, direct_owner, direct_alice, direct_bob)
    with direct_vm.expect_revert("already exists"):
        _register(contract, direct_vm, direct_owner, direct_alice, direct_bob)


def test_short_evidence_reverts(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_deploy)
    _register(contract, direct_vm, direct_owner, direct_alice, direct_bob)
    with direct_vm.expect_revert("too short"):
        contract.audit("lic-1", "short")


def test_claim_flow(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = deploy(direct_deploy)
    _register(contract, direct_vm, direct_owner, direct_alice, direct_bob, threshold=1)
    direct_vm.sender = direct_bob
    direct_vm.value = 100 * ONE_GEN
    contract.deposit_stake("lic-1")

    mock_audit(direct_vm, severity=10)
    direct_vm.value = 0
    contract.audit("lic-1", "Egregiously off-brand output that breaks every boundary.")

    # Expert (alice) has accrued compensation and can claim it.
    accrued = int(contract.get_accrued(hx(direct_alice)))
    assert accrued > 0
    direct_vm.sender = direct_alice
    contract.claim()
    assert contract.get_accrued(hx(direct_alice)) == "0"

    # A second claim with nothing left reverts.
    with direct_vm.expect_revert("Nothing to claim"):
        contract.claim()


def test_validator_agrees_within_tolerance(
    direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob
):
    """Consensus check: a validator that scores within tolerance agrees; one that
    flips the verdict disagrees."""
    contract = deploy(direct_deploy)
    _register(contract, direct_vm, direct_owner, direct_alice, direct_bob)
    direct_vm.sender = direct_bob
    direct_vm.value = 100 * ONE_GEN
    contract.deposit_stake("lic-1")

    # Leader scores 9 (violation).
    mock_audit(direct_vm, severity=9)
    direct_vm.value = 0
    contract.audit("lic-1", "Fear-based, off-brand output pressuring the reader.")

    # Validator also sees a violation (severity 8, within +/-2) -> agree.
    direct_vm.clear_mocks()
    mock_audit(direct_vm, severity=8)
    assert direct_vm.run_validator() is True

    # Validator sees full compliance (severity 1) -> verdict flips -> disagree.
    direct_vm.clear_mocks()
    mock_audit(direct_vm, severity=1)
    assert direct_vm.run_validator() is False
