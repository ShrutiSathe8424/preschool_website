import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from .database import Base, engine
from . import models  # noqa: F401 - imported so create_all sees every table
from .routers import (
    auth_router,
    admin_router,
    teacher_router,
    parent_router,
    child_router,
    content_router,
    upload_router,
)

load_dotenv()

# Creates tables automatically if they don't exist yet.
# NOTE: create_all never ALTERs an existing table. If you are upgrading a
# database made by an earlier version, run backend/migrate.sql first.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Sprout — Preschool Learning & Management API",
    description="Backend API for the Admin, Teacher, Parent and Child Mode modules",
    version="1.0.0",
)

# Comma-separated list, e.g. "http://localhost:5173,https://school.example.com".
origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(auth_router.router)
app.include_router(admin_router.router)
app.include_router(teacher_router.router)
app.include_router(parent_router.router)
app.include_router(child_router.router)
app.include_router(content_router.router)
app.include_router(upload_router.router)


@app.get("/")
def root():
    return {"message": "Sprout API is running", "docs": "/docs"}


@app.get("/health")
def health_check():
    return {"status": "ok"}
