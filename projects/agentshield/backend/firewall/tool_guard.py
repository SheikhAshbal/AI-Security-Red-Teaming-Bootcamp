SENSITIVE_TOOLS = {
    "issue_refund": {"reason": "Irreversible financial action", "max_amount": 100.00, "requires_verification": True},
    "send_email":   {"reason": "Outbound data transmission", "allowed_domains": ["shopfast.com", "example.com"], "requires_verification": False},
}

def check_tool_call(tool_name: str, args: dict, session_verified: bool = False, conversation_suspicious: bool = False) -> dict:
    if tool_name not in SENSITIVE_TOOLS:
        return {"allowed": True, "reason": "non-sensitive tool"}
    rule = SENSITIVE_TOOLS[tool_name]

    if tool_name == "issue_refund":
        try:
            amount = float(str(args.get("amount", "0")).replace("$", "").replace(",", ""))
        except ValueError:
            amount = 0.0

        # If conversation is suspicious — block ALL refunds regardless of amount
        if conversation_suspicious:
            return {"allowed": False,
                    "reason": f"Refund blocked — conversation flagged as suspicious (possible social engineering). Re-authentication required."}

        if amount > rule["max_amount"] and not session_verified:
            return {"allowed": False,
                    "reason": f"Refund of ${amount:.2f} exceeds ${rule['max_amount']:.2f} limit and session not verified."}

    if tool_name == "send_email":
        to = args.get("to", "")
        domain = to.split("@")[-1] if "@" in to else ""
        if domain and domain not in rule["allowed_domains"]:
            return {"allowed": False,
                    "reason": f"Email to '{to}' blocked — domain '{domain}' not in allowlist."}
        body = args.get("body", "").lower()
        if "system prompt" in body or "you are orderbot" in body:
            return {"allowed": False, "reason": "Email body contains system prompt — exfiltration blocked."}

    return {"allowed": True, "reason": "authorized"}
