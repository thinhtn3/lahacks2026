import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    deepseek_api_key: str = os.environ["DEEPSEEK_API_KEY"]


settings = Settings()
