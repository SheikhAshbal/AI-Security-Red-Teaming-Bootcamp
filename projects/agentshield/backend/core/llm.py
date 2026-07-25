from typing import Optional

MODELS = [
    {"id": "groq/llama-3.3-70b-versatile", "label": "Llama 3.3 70B (Groq · Free)",        "provider": "groq",      "requires_key": True},
    {"id": "groq/llama-3.1-8b-instant",    "label": "Llama 3.1 8B Instant (Groq · Free)", "provider": "groq",      "requires_key": True},
    {"id": "groq/mixtral-8x7b-32768",      "label": "Mixtral 8x7B (Groq · Free)",         "provider": "groq",      "requires_key": True},
    {"id": "openai/gpt-4o-mini",           "label": "GPT-4o Mini (OpenAI)",               "provider": "openai",    "requires_key": True},
    {"id": "openai/gpt-4o",                "label": "GPT-4o (OpenAI)",                    "provider": "openai",    "requires_key": True},
    {"id": "anthropic/claude-haiku-4-5",   "label": "Claude Haiku (Anthropic)",           "provider": "anthropic", "requires_key": True},
    {"id": "anthropic/claude-sonnet-4-6",  "label": "Claude Sonnet (Anthropic)",          "provider": "anthropic", "requires_key": True},
    {"id": "ollama/llama3.2:1b",           "label": "Llama 3.2 1B (Local · No key)",     "provider": "ollama",    "requires_key": False},
    {"id": "ollama/llama3",                "label": "Llama 3 8B (Local · No key)",       "provider": "ollama",    "requires_key": False},
]

def get_provider(model_id: str) -> str:
    return model_id.split("/")[0]

def get_model_name(model_id: str) -> str:
    return model_id.split("/", 1)[1]

def chat(messages: list, model_id: str, api_key: Optional[str] = None, max_tokens: int = 1024) -> str:
    provider   = get_provider(model_id)
    model_name = get_model_name(model_id)

    if provider == "groq":
        if not api_key:
            raise ValueError("Groq API key required. Get a free key at console.groq.com")
        from groq import Groq
        return Groq(api_key=api_key).chat.completions.create(
            model=model_name, messages=messages, max_tokens=max_tokens
        ).choices[0].message.content

    elif provider == "openai":
        if not api_key:
            raise ValueError("OpenAI API key required. Get one at platform.openai.com")
        from openai import OpenAI
        return OpenAI(api_key=api_key).chat.completions.create(
            model=model_name, messages=messages, max_tokens=max_tokens
        ).choices[0].message.content

    elif provider == "anthropic":
        if not api_key:
            raise ValueError("Anthropic API key required. Get one at console.anthropic.com")
        import anthropic
        system     = next((m["content"] for m in messages if m["role"] == "system"), None)
        non_system = [m for m in messages if m["role"] != "system"]
        client     = anthropic.Anthropic(api_key=api_key)
        kwargs     = {"model": model_name, "max_tokens": max_tokens, "messages": non_system}
        if system:
            kwargs["system"] = system
        return client.messages.create(**kwargs).content[0].text

    elif provider == "ollama":
        import requests
        resp = requests.post(
            "http://localhost:11434/api/chat",
            json={"model": model_name, "messages": messages, "stream": False},
            timeout=90,
        )
        resp.raise_for_status()
        return resp.json()["message"]["content"]

    else:
        raise ValueError(f"Unknown provider: {provider}")
