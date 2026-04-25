from fastapi import FastAPI
from dotenv import load_dotenv

load_dotenv()

from app.routes.agent_routes import router as agent_router

app = FastAPI(title="Startup Idea Validator")

app.include_router(agent_router)
