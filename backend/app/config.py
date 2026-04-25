import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    gemini_api_key: str = os.environ["GEMINI_API_KEY"]


settings = Settings()
