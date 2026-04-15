"""
Thin LLM provider abstraction supporting Anthropic (Claude) and OpenAI.
Callers pass provider/api_key/model at construction; the rest of the
codebase stays provider-agnostic.
"""
import json
from typing import Any

import anthropic
import openai


class LLMProvider:
    def __init__(self, provider: str, api_key: str, model: str) -> None:
        self.provider = provider
        self.model = model

        if provider == "anthropic":
            self._anthropic = anthropic.AsyncAnthropic(api_key=api_key)
        elif provider == "openai":
            self._openai = openai.AsyncOpenAI(api_key=api_key)
        else:
            raise ValueError(f"Unsupported provider: {provider!r}")

    async def complete(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 512,
        temperature: float = 0.3,
    ) -> str:
        """Return raw text response."""
        if self.provider == "anthropic":
            # Separate optional system message from the rest
            system = ""
            user_messages = []
            for m in messages:
                if m["role"] == "system":
                    system = m["content"]
                else:
                    user_messages.append(m)

            kwargs: dict[str, Any] = dict(
                model=self.model,
                max_tokens=max_tokens,
                temperature=temperature,
                messages=user_messages,
            )
            if system:
                kwargs["system"] = system

            response = await self._anthropic.messages.create(**kwargs)
            return response.content[0].text

        # OpenAI
        response = await self._openai.chat.completions.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=messages,  # type: ignore[arg-type]
        )
        return response.choices[0].message.content or ""

    async def complete_json(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 512,
    ) -> Any:
        """Return parsed JSON. The prompt must instruct the model to reply with JSON."""
        if self.provider == "openai":
            system = ""
            user_messages = []
            for m in messages:
                if m["role"] == "system":
                    system = m["content"]
                else:
                    user_messages.append(m)

            all_messages = (
                [{"role": "system", "content": system}] + user_messages
                if system
                else user_messages
            )
            response = await self._openai.chat.completions.create(
                model=self.model,
                max_tokens=max_tokens,
                temperature=0,
                messages=all_messages,  # type: ignore[arg-type]
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content or "{}"
        else:
            raw = await self.complete(messages, max_tokens=max_tokens, temperature=0)

        # Strip markdown code fences if present
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0]

        return json.loads(raw)
