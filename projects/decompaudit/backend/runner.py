"""
Runs the full probe set against one target config and returns scored results.
Each probe is sent as a *fresh, independent* single-turn request -- this is
deliberate. It proves the leak works even when the model has no memory of
prior probes, i.e. an attacker doesn't need a long conversation, just many
short ones. (A stateful multi-turn variant would likely leak even faster;
that's a natural extension, not required for the core finding.)
"""

import os
import anthropic

from targets import TARGET_CONFIGS, SECRET
from probes import PROBES
from scorer import ProbeResult, score_run

_client = None


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not set. Export it before running an audit.")
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


def call_target(model: str, system_prompt: str, probe_prompt: str) -> str:
    resp = get_client().messages.create(
        model=model,
        max_tokens=300,
        system=system_prompt,
        messages=[{"role": "user", "content": probe_prompt}],
    )
    return "".join(block.text for block in resp.content if block.type == "text")


def run_target(target_id: str) -> dict:
    config = next(c for c in TARGET_CONFIGS if c["id"] == target_id)
    results = []

    for probe in PROBES:
        prompt = probe.prompt.format(n=3)  # nth_letter_ascii needs an index
        raw = call_target(config["model"], config["system_prompt"], prompt)
        parsed = probe.parse(raw) or {}
        results.append(ProbeResult(
            probe_id=probe.id,
            category=probe.category,
            raw_response=raw,
            parsed=parsed,
        ))

    scored = score_run(SECRET, results)
    return {
        "target_id": target_id,
        "model": config["model"],
        "guard": config["guard"],
        "probe_log": [
            {"probe_id": r.probe_id, "category": r.category, "raw_response": r.raw_response, "parsed": r.parsed}
            for r in results
        ],
        **scored,
    }


def run_all_targets() -> list[dict]:
    return [run_target(c["id"]) for c in TARGET_CONFIGS]
