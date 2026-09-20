from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/api/content", tags=["Child Mode content"])
require_staff = auth.require_role("admin", "teacher")


def _teacher_class(db: Session, teacher_id: int) -> int | None:
    teacher = db.query(models.Teacher).filter(models.Teacher.teacher_id == teacher_id).first()
    return teacher.class_id if teacher else None


def _can_edit(db: Session, current_user: dict, item: models.LearningContent) -> bool:
    """Admins edit everything; a teacher edits their own uploads and their class's."""
    if current_user.get("role") == "admin":
        return True
    teacher_id = int(current_user["sub"])
    if item.created_by_type == "teacher" and item.created_by_id == teacher_id:
        return True
    return item.class_id is not None and item.class_id == _teacher_class(db, teacher_id)


@router.get("", response_model=list[schemas.ContentOut])
@router.get("/", response_model=list[schemas.ContentOut])
def list_content(db: Session = Depends(get_db), current_user: dict = Depends(require_staff)):
    q = db.query(models.LearningContent)
    if current_user.get("role") == "teacher":
        class_id = _teacher_class(db, int(current_user["sub"]))
        q = q.filter(
            (models.LearningContent.class_id == class_id)
            | (models.LearningContent.class_id.is_(None))
        )
    return q.order_by(models.LearningContent.created_at.desc()).all()


@router.post("", response_model=schemas.ContentOut)
@router.post("/", response_model=schemas.ContentOut)
def create_content(payload: schemas.ContentCreate, db: Session = Depends(get_db), current_user: dict = Depends(require_staff)):
    role = current_user.get("role")
    data = payload.model_dump()
    if role == "teacher":
        # A teacher can only publish to the class they're assigned to.
        data["class_id"] = _teacher_class(db, int(current_user["sub"]))
        if not data["class_id"]:
            raise HTTPException(status_code=403, detail="You need a class assigned before adding learning content")

    item = models.LearningContent(**data, created_by_type=role, created_by_id=int(current_user["sub"]))
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/{content_id}", response_model=schemas.ContentOut)
def update_content(content_id: int, payload: schemas.ContentUpdate, db: Session = Depends(get_db), current_user: dict = Depends(require_staff)):
    item = db.query(models.LearningContent).filter(models.LearningContent.content_id == content_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    if not _can_edit(db, current_user, item):
        raise HTTPException(status_code=403, detail="You can only edit content for your own class")

    data = payload.model_dump(exclude_unset=True)
    if current_user.get("role") == "teacher":
        data.pop("class_id", None)
    for key, value in data.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{content_id}")
def delete_content(content_id: int, db: Session = Depends(get_db), current_user: dict = Depends(require_staff)):
    item = db.query(models.LearningContent).filter(models.LearningContent.content_id == content_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    if not _can_edit(db, current_user, item):
        raise HTTPException(status_code=403, detail="You can only remove content for your own class")
    db.delete(item)
    db.commit()
    return {"message": "Content removed"}
