from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    app_name: str = "FastAPI Backend"
    app_version: str = "0.1.0"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"

    postgres_user: str = "postgres"
    postgres_password: str = "postgres"
    postgres_server: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "app_db"

    @property
    def sqlalchemy_database_uri(self) -> str:
        return (
            "postgresql+psycopg://"
            f"{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_server}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
