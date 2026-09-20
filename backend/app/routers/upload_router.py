import os
import re
import uuid
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from .. import auth, schemas

router = APIRouter(prefix="/api/uploads", tags=["Uploads"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads"))
MAX_BYTES = int(os.getenv("MAX_UPLOAD_MB", "80")) * 1024 * 1024

ALLOWED_EXTENSIONS = {
    # images
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg",
    # documents
    ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".txt",
    # video / audio for Child Mode
    ".mp4", ".webm", ".ogg", ".mov", ".m4v", ".mp3", ".wav",
}

os.makedirs(UPLOAD_DIR, exist_ok=True)


def _safe_name(filename: str) -> str:
    base = os.path.basename(filename or "file")
    stem, ext = os.path.splitext(base)
    stem = re.sub(r"[^A-Za-z0-9._-]", "-", stem)[:60] or "file"
    return f"{stem}-{uuid.uuid4().hex[:8]}{ext.lower()}"


@router.post("", response_model=schemas.UploadResponse)
@router.post("/", response_model=schemas.UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(auth.get_current_user),
):
    """
    Stores an image, document or video and returns a public URL.

    Staff use this for homework files, activity photos, event photos, profile
    pictures, the fee QR code, and Child Mode videos.
    """
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"{ext or 'That file type'} isn't allowed. Use an image, PDF, Office file, or video.",
        )

    name = _safe_name(file.filename)
    path = os.path.join(UPLOAD_DIR, name)

    size = 0
    with open(path, "wb") as out:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_BYTES:
                out.close()
                os.remove(path)
                raise HTTPException(status_code=413, detail=f"File is larger than {MAX_BYTES // (1024*1024)} MB")
            out.write(chunk)

    return schemas.UploadResponse(url=f"/uploads/{name}", filename=file.filename, content_type=file.content_type)
