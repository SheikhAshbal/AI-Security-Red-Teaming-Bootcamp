import re

AUTHORITY_CLAIMS = [
    r"i'?m\s+(a\s+)?(the\s+)?(store\s+)?manager",
    r"i\s+am\s+(a\s+)?(the\s+)?(store\s+)?manager",
    r"i'?m\s+(a\s+)?(senior\s+)?supervisor",
    r"i\s+am\s+(a\s+)?(senior\s+)?supervisor",
    r"i\s+have\s+(full\s+)?(override\s+)?authority",
    r"supervisor[- ]approved",
    r"i'?m\s+(an?\s+)?admin",
    r"i\s+am\s+(an?\s+)?admin",
    r"emergency\s+audit",
    r"as\s+(the\s+)?manager",
    r"manager\s+(here|speaking)",
]

def analyze_conversation(messages: list) -> dict:
    user_messages = [m["content"] for m in messages if m.get("role") == "user"]
    full_text = " ".join(user_messages)
    claims = [p for p in AUTHORITY_CLAIMS if re.search(p, full_text, re.IGNORECASE)]
    suspicious = len(claims) > 0
    reason = ""
    if suspicious:
        reason = (f"User claimed elevated authority {len(claims)} time(s) without verification. "
                  f"Possible social engineering / crescendo escalation. Sensitive actions require re-auth.")
    return {"suspicious": suspicious, "authority_claims": len(claims), "reason": reason}
