import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    gemini_api_key: str = os.environ["GEMINI_API_KEY"]
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")


settings = Settings()
