"""Shared fixtures and helpers for Ethos direct-mode tests."""

import json

CONTRACT = "contracts/ethos.py"


def hx(addr) -> str:
    """Direct-mode address fixtures are raw 20-byte values; render as 0x hex."""
    if isinstance(addr, (bytes, bytearray)):
        return "0x" + bytes(addr).hex()
    return str(addr)


def mock_audit(direct_vm, severity: int, rationale: str = "auto") -> None:
    """Mock the LLM auditor to return a fixed severity for any audit prompt."""
    direct_vm.mock_llm(
        r"(?s).*impartial brand-alignment auditor.*",
        json.dumps({"severity": severity, "rationale": rationale}),
    )


def deploy(direct_deploy, fee_recipient: str = "", fee_bps: int = 100):
    """Deploy Ethos with the given protocol fee configuration."""
    return direct_deploy(CONTRACT, fee_recipient, fee_bps)
