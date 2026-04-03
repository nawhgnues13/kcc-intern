from pathlib import Path

from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    gemini_api_key: str
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/kcc_intern"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "ap-northeast-2"
    aws_s3_bucket: str = ""
    aws_s3_profile_image_prefix: str = "profile-images"
    aws_s3_newsletter_prefix: str = "newsletter-assets"
    aws_s3_endpoint_url: str = ""
    slack_bot_token: str = ""
    slack_signing_secret: str = ""
    slack_app_token: str = ""
    slack_channel_id: str = ""
    gmail_user: str = ""
    gmail_app_password: str = ""
    email_to: str = ""
    resend_api_key: str = ""
    email_from: str = ""
    unsubscribe_secret: str = "change-me-in-production"
    server_url: str = "http://localhost:8000"
    instagram_publish_access_token: str = ""
    instagram_publish_ig_user_id: str = ""
    instagram_publish_api_version: str = "v25.0"
    instagram_publish_host_url: str = "graph.instagram.com"
    external_crm_base_url: str = ""
    external_crm_secret_key: str = ""

    class Config:
        env_file = str(BASE_DIR / ".env")


settings = Settings()
