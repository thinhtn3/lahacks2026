from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from app.routes.agent_routes import router as agent_router
from app.routes.speech_routes import router as speech_router
from app.routes.analyze import router as analyze_router
from app.routes.verdict import router as verdict_router

app = FastAPI(title="Startup Idea Validator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agent_router)
app.include_router(speech_router)
app.include_router(analyze_router, prefix="/api")
app.include_router(verdict_router, prefix="/api")
