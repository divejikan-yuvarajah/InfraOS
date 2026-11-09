"""Environment-driven settings. Fails fast on missing/weak required values; never logs or echoes secrets."""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PIPELINE_VERSION = "p1"
MIN_SECRET_LENGTH = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    app_env: str = "production"  # development | test | production
    port: int = 8000

    ai_internal_secret: SecretStr = Field(default=SecretStr(""))
    openrouter_api_key: SecretStr = Field(default=SecretStr(""))
    embed_api_key: SecretStr = Field(default=SecretStr(""))
    embed_base_url: str = "https://openrouter.ai/api/v1"
    ai_embed_model: str = ""

    # Chat/LLM layer (Batch 10). Model ids come only from env; the default is the live-probed low-cost model.
    ai_chat_model: str = ""
    ai_chat_model_strong: str = ""
    chat_base_url: str = ""
    llm_structured_mode: str = "json_schema"  # json_schema | json_object (set by the capability check)
    llm_concurrency: int = 3
    llm_answer_timeout_s: float = 45.0
    llm_map_timeout_s: float = 30.0
    llm_reduce_timeout_s: float = 40.0
    llm_extract_timeout_s: float = 40.0
    llm_max_retries: int = 2

    qdrant_url: str = ""
    qdrant_api_key: SecretStr = Field(default=SecretStr(""))
    qdrant_collection: str = "infraos_chunks"

    # Limits (defaults sized for a 512 MB free-tier instance).
    max_body_bytes: int = 30 * 1024 * 1024
    max_pages: int = 300
    max_chars: int = 3_000_000
    max_chunks: int = 1_500
    extract_timeout_s: float = 90.0
    extract_concurrency: int = 2
    embed_timeout_s: float = 30.0
    embed_max_retries: int = 3
    embed_batch_size: int = 64
    embed_batch_max_tokens: int = 8_000
    qdrant_timeout_s: float = 15.0
    clock_skew_s: int = 60

    @field_validator("app_env")
    @classmethod
    def _env(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in {"development", "test", "production"}:
            raise ValueError("APP_ENV must be development, test or production")
        return v

    @model_validator(mode="after")
    def _required(self) -> "Settings":
        if len(self.ai_internal_secret.get_secret_value()) < MIN_SECRET_LENGTH:
            raise ValueError(f"AI_INTERNAL_SECRET must be set and at least {MIN_SECRET_LENGTH} characters")
        return self

    @property
    def is_dev(self) -> bool:
        return self.app_env == "development"

    @property
    def is_test(self) -> bool:
        return self.app_env == "test"

    @property
    def chat_url(self) -> str:
        return (self.chat_base_url or self.embed_base_url).rstrip("/")

    @property
    def chat_key(self) -> str:
        return self.embed_key

    @property
    def embed_key(self) -> str:
        return self.embed_api_key.get_secret_value() or self.openrouter_api_key.get_secret_value()


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
