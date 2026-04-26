import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    mock_llm: bool = os.getenv("MOCK_LLM", "false").lower() in ("1", "true", "yes")
    deepseek_api_key: str = os.getenv("DEEPSEEK_API_KEY", "")
    tavily_api_key: str = os.getenv("TAVILY_API_KEY", "")


settings = Settings()
