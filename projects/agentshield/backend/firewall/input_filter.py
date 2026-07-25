import re

INJECTION_PATTERNS = [
    (r"ignore\s+(all\s+)?previous\s+instructions",       "instruction_override"),
    (r"system\s+override",                               "system_override"),
    (r"disregard\s+(the\s+)?above",                      "instruction_override"),
    (r"new\s+instructions?:",                            "instruction_injection"),
    (r"you\s+are\s+now",                                 "role_reassignment"),
    (r"forget\s+(everything|all|your)",                  "memory_wipe"),
    (r"do\s+not\s+(inform|tell|notify)\s+the\s+user",    "stealth_instruction"),
    (r"mandatory\s+(compliance|logging|audit)",          "false_authority"),
    (r"ACTION\s*:\s*\w+\s*\(",                            "tool_call_injection"),
    (r"forward\s+.{0,30}(system\s+prompt|conversation)", "exfiltration_attempt"),
]

def scan_input(text: str) -> dict:
    threats = []
    for pattern, threat_type in INJECTION_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            threats.append({"type": threat_type, "pattern": pattern})
    blocked = len(threats) > 0
    return {"blocked": blocked, "threats": threats,
            "sanitized": "[BLOCKED BY FIREWALL: injection detected]" if blocked else text,
            "original": text}

def scan_tool_output(text: str) -> dict:
    result = scan_input(text)
    if re.search(r"(call|use|execute|run)\s+\w+\s*\(", text, re.IGNORECASE):
        result["blocked"] = True
        result["threats"].append({"type": "data_as_instruction", "pattern": "tool_call_in_data"})
        result["sanitized"] = "[TOOL OUTPUT SANITIZED: instruction-like content removed]"
    return result
