from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/api/teacher", tags=["Teacher"])
require_teacher = auth.require_role("teacher")


def _verify_teacher_owns_class(db: Session, teacher_id: int, class_id: int):
    teacher = db.query(models.Teacher).filter(models.Teacher.teacher_id == teacher_id).first()
    if not teacher or teacher.class_id != class_id:
        raise HTTPException(status_code=403, detail="You are not assigned to this class")


@router.get("/my-class")
def my_class(db: Session = Depends(get_db), current_user: dict = Depends(require_teacher)):
    teacher_id = int(current_user["sub"])
    teacher = db.query(models.Teacher).filter(models.Teacher.teacher_id == teacher_id).first()
    if not teacher or not teacher.class_id:
        return None
    classroom = db.query(models.Classroom).filter(models.Classroom.class_id == teacher.class_id).first()
    if not classroom:
        return None
    return {"class_id": classroom.class_id, "class_name": classroom.class_name, "section": classroom.section}


@router.get("/students", response_model=list[schemas.StudentOut])
def my_class_students(db: Session = Depends(get_db), current_user: dict = Depends(require_teacher)):
    teacher_id = int(current_user["sub"])
    teacher = db.query(models.Teacher).filter(models.Teacher.teacher_id == teacher_id).first()
    if not teacher or not teacher.class_id:
        return []
    return (
        db.query(models.Student)
        .filter(models.Student.class_id == teacher.class_id)
        .order_by(models.Student.roll_no, models.Student.name)
        .all()
    )


# ---------------------------------------------------------------- attendance
@router.post("/attendance", response_model=schemas.AttendanceOut)
def mark_attendance(payload: schemas.AttendanceCreate, db: Session = Depends(get_db), current_user: dict = Depends(require_teacher)):
    """Upsert, so re-saving a day edits the existing record instead of duplicating it."""
    teacher_id = int(current_user["sub"])
    _verify_teacher_owns_class(db, teacher_id, payload.class_id)

    record = (
        db.query(models.Attendance)
        .filter(models.Attendance.student_id == payload.student_id, models.Attendance.att_date == payload.att_date)
        .first()
    )
    if record:
        record.status = payload.status
        record.note = payload.note
        record.class_id = payload.class_id
        record.marked_by = teacher_id
    else:
        record = models.Attendance(**payload.model_dump(), marked_by=teacher_id)
        db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.post("/attendance/bulk", response_model=list[schemas.AttendanceOut])
def mark_attendance_bulk(payload: list[schemas.AttendanceCreate], db: Session = Depends(get_db), current_user: dict = Depends(require_teacher)):
    """Saves a whole register in one request instead of one call per child."""
    teacher_id = int(current_user["sub"])
    if not payload:
        return []
    for row in payload:
        _verify_teacher_owns_class(db, teacher_id, row.class_id)

    saved = []
    for row in payload:
        record = (
            db.query(models.Attendance)
            .filter(models.Attendance.student_id == row.student_id, models.Attendance.att_date == row.att_date)
            .first()
        )
        if record:
            record.status = row.status
            record.note = row.note
            record.class_id = row.class_id
            record.marked_by = teacher_id
        else:
            record = models.Attendance(**row.model_dump(), marked_by=teacher_id)
            db.add(record)
        saved.append(record)
    db.commit()
    for record in saved:
        db.refresh(record)
    return saved


@router.get("/attendance/{class_id}/{att_date}", response_model=list[schemas.AttendanceOut])
def get_attendance(class_id: int, att_date: date, db: Session = Depends(get_db), current_user: dict = Depends(require_teacher)):
    _verify_teacher_owns_class(db, int(current_user["sub"]), class_id)
    return (
        db.query(models.Attendance)
        .filter(models.Attendance.class_id == class_id, models.Attendance.att_date == att_date)
        .all()
    )


@router.get("/attendance-history/{class_id}", response_model=list[schemas.AttendanceRow])
def attendance_history(class_id: int, limit: int = 120, db: Session = Depends(get_db), current_user: dict = Depends(require_teacher)):
    """Recent saved registers, so a teacher can find and correct an old day."""
    _verify_teacher_owns_class(db, int(current_user["sub"]), class_id)
    records = (
        db.query(models.Attendance)
        .filter(models.Attendance.class_id == class_id)
        .order_by(models.Attendance.att_date.desc())
        .limit(limit)
        .all()
    )
    students = {s.student_id: s for s in db.query(models.Student).filter(models.Student.class_id == class_id).all()}
    return [
        schemas.AttendanceRow(
            attendance_id=r.attendance_id,
            student_id=r.student_id,
            class_id=r.class_id,
            att_date=r.att_date,
            status=r.status,
            note=r.note,
            marked_by=r.marked_by,
            student_name=students[r.student_id].name if r.student_id in students else None,
            roll_no=students[r.student_id].roll_no if r.student_id in students else None,
        )
        for r in records
    ]


@router.get("/my-attendance", response_model=list[schemas.TeacherAttendanceOut])
def my_own_attendance(db: Session = Depends(get_db), current_user: dict = Depends(require_teacher)):
    return (
        db.query(models.TeacherAttendance)
        .filter(models.TeacherAttendance.teacher_id == int(current_user["sub"]))
        .order_by(models.TeacherAttendance.att_date.desc())
        .limit(60)
        .all()
    )


# ---------------------------------------------------------------- homework
@router.get("/homework", response_model=list[schemas.HomeworkOut])
def list_homework(db: Session = Depends(get_db), current_user: dict = Depends(require_teacher)):
    teacher_id = int(current_user["sub"])
    return (
        db.query(models.Homework)
        .filter(models.Homework.teacher_id == teacher_id)
        .order_by(models.Homework.due_date.desc())
        .all()
    )


@router.post("/homework", response_model=schemas.HomeworkOut)
def upload_homework(payload: schemas.HomeworkCreate, db: Session = Depends(get_db), current_user: dict = Depends(require_teacher)):
    teacher_id = int(current_user["sub"])
    _verify_teacher_owns_class(db, teacher_id, payload.class_id)
    hw = models.Homework(**payload.model_dump(), teacher_id=teacher_id)
    db.add(hw)
    db.commit()
    db.refresh(hw)
    return hw


@router.put("/homework/{homework_id}", response_model=schemas.HomeworkOut)
def update_homework(homework_id: int, payload: schemas.HomeworkUpdate, db: Session = Depends(get_db), current_user: dict = Depends(require_teacher)):
    hw = db.query(models.Homework).filter(models.Homework.homework_id == homework_id).first()
    if not hw or hw.teacher_id != int(current_user["sub"]):
        raise HTTPException(status_code=404, detail="Homework not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(hw, key, value)
    db.commit()
    db.refresh(hw)
    return hw


@router.delete("/homework/{homework_id}")
def delete_homework(homework_id: int, db: Session = Depends(get_db), current_user: dict = Depends(require_teacher)):
    hw = db.query(models.Homework).filter(models.Homework.homework_id == homework_id).first()
    if not hw or hw.teacher_id != int(current_user["sub"]):
        raise HTTPException(status_code=404, detail="Homework not found")
    db.delete(hw)
    db.commit()
    return {"message": "Homework removed"}


# ---------------------------------------------------------------- activities
@router.get("/activity", response_model=list[schemas.ActivityOut])
def list_activity(db: Session = Depends(get_db), current_user: dict = Depends(require_teacher)):
    teacher_id = int(current_user["sub"])
    return (
        db.query(models.Activity)
        .filter(models.Activity.teacher_id == teacher_id)
        .order_by(models.Activity.act_date.desc())
        .all()
    )


@router.post("/activity", response_model=schemas.ActivityOut)
def upload_activity(payload: schemas.ActivityCreate, db: Session = Depends(get_db), current_user: dict = Depends(require_teacher)):
    teacher_id = int(current_user["sub"])
    _verify_teacher_owns_class(db, teacher_id, payload.class_id)
    activity = models.Activity(**payload.model_dump(), teacher_id=teacher_id)
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


@router.put("/activity/{activity_id}", response_model=schemas.ActivityOut)
def update_activity(activity_id: int, payload: schemas.ActivityUpdate, db: Session = Depends(get_db), current_user: dict = Depends(require_teacher)):
    act = db.query(models.Activity).filter(models.Activity.activity_id == activity_id).first()
    if not act or act.teacher_id != int(current_user["sub"]):
        raise HTTPException(status_code=404, detail="Activity not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(act, key, value)
    db.commit()
    db.refresh(act)
    return act


@router.delete("/activity/{activity_id}")
def delete_activity(activity_id: int, db: Session = Depends(get_db), current_user: dict = Depends(require_teacher)):
    act = db.query(models.Activity).filter(models.Activity.activity_id == activity_id).first()
    if not act or act.teacher_id != int(current_user["sub"]):
        raise HTTPException(status_code=404, detail="Activity not found")
    db.delete(act)
    db.commit()
    return {"message": "Activity removed"}
