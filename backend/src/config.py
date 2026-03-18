from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    gemini_api_key: str
    slack_bot_token: str = ""
    slack_signing_secret: str = ""
    slack_app_token: str = ""
    slack_channel_id: str = ""
    gmail_user: str = ""
    gmail_app_password: str = ""
    email_to: str = ""
    server_url: str = "http://localhost:8000"

    class Config:
        env_file = ".env"


settings = Settings()
