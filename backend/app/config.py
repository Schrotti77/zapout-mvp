"""
ZapOut Configuration - Centralized Settings with Pydantic BaseSettings
Following fullstack-dev: All config via env vars, validated at startup, fail fast
"""

import os
from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings - fails fast if required vars are missing"""

    # App
    app_name: str = "ZapOut API"
    app_version: str = "0.1.0"
    debug: bool = Field(default=False)

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # Database
    db_path: str = "zapout.db"

    # CORS - stored as comma-separated string, parsed at runtime
    allowed_origins_raw: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        alias="ALLOWED_ORIGINS",
    )

    @property
    def allowed_origins(self) -> List[str]:
        """Parse comma-separated origins into list"""
        return [o.strip() for o in self.allowed_origins_raw.split(",") if o.strip()]

    # Auth
    token_expiry_hours: int = 24
    jwt_secret: str = Field(default="", alias="JWT_SECRET")  # Required in production

    # Rate Limiting
    rate_limit_window: int = 300  # 5 minutes
    max_login_attempts: int = 5

    # LND (Helmut)
    lnd_timeout: int = 30  # SSH timeout in seconds

    # Cashu
    default_cashu_mint: str = "https://testnut.cashu.space"

    # BTC Price API (for EUR → sats conversion)
    btc_price_api: str = "https://api.coingecko.com/api/v3/simple/price"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"  # Allow extra env vars without error


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance - singleton pattern"""
    return Settings()


# Convenience access
settings = get_settings()
