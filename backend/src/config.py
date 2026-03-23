from pydantic_settings import BaseSettings


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
    server_url: str = "http://localhost:8000"

    class Config:
        env_file = ".env"


settings = Settings()
