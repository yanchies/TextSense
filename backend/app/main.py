from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import analysis, export, results, upload


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up the embedding model at startup so the first analysis
    # request doesn't pay the cold-load cost.
    from .services.embedder import _get_model
    _get_model()
    yield


app = FastAPI(
    title="TextSense API",
    version="2.0.0",
    description="Qualitative feedback analysis — topic modelling + sentiment scoring.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(analysis.router)
app.include_router(results.router)
app.include_router(export.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
