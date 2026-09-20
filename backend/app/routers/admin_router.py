import re
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/api/admin", tags=["Admin"])
require_admin = auth.require_role("admin")


# ---------------------------------------------------------------- helpers
def _get_or_404(db: Session, model, pk_column, pk, label: str):
    row = db.query(model).filter(pk_column == pk).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return row


def _class_prefix(classroom: models.Classroom | None) -> str:
    if not classroom:
        return "STU"
    letters = re.sub(r"[^A-Za-z]", "", classroom.class_name or "")[:3].upper() or "STU"
    if classroom.section:
        return f"{letters}-{re.sub(r'[^A-Za-z0-9]', '', classroom.section)[:2].upper()}"
    return letters


def _next_roll_no(db: Session, class_id: int | None) -> str:
    """
    Builds a readable, school-wide unique roll number such as NUR-A-007.
    Numbering restarts per class and skips any number already taken.
    """
    classroom = None
    if class_id:
        classroom = db.query(models.Classroom).filter(models.Classroom.class_id == class_id).first()
    prefix = _class_prefix(classroom)

    existing = {
        r[0] for r in db.query(models.Student.roll_no).filter(models.Student.roll_no.isnot(None)).all()
    }
    n = 1
    while f"{prefix}-{n:03d}" in existing:
        n += 1
    return f"{prefix}-{n:03d}"


def _email_taken(db: Session, model, email: str, exclude_id=None, pk_column=None) -> bool:
    q = db.query(model).filter(model.email == email)
    if exclude_id is not None and pk_column is not None:
        q = q.filter(pk_column != exclude_id)
    return q.first() is not None


# ---------------------------------------------------------------- overview
@router.get("/dashboard")
def dashboard_stats(db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    today = date.today()
    total_students = db.query(func.count(models.Student.student_id)).scalar()
    total_teachers = db.query(func.count(models.Teacher.teacher_id)).scalar()
    total_classes = db.query(func.count(models.Classroom.class_id)).scalar()
    present_today = (
        db.query(func.count(models.Attendance.attendance_id))
        .filter(models.Attendance.att_date == today, models.Attendance.status == "present")
        .scalar()
    )
    staff_present_today = (
        db.query(func.count(models.TeacherAttendance.id))
        .filter(models.TeacherAttendance.att_date == today, models.TeacherAttendance.status == "present")
        .scalar()
    )
    pending_fees = db.query(func.count(models.Fee.fee_id)).filter(models.Fee.status != "paid").scalar()
    pending_amount = (
        db.query(func.coalesce(func.sum(models.Fee.amount), 0)).filter(models.Fee.status != "paid").scalar()
    )
    collected_amount = (
        db.query(func.coalesce(func.sum(models.Fee.amount), 0)).filter(models.Fee.status == "paid").scalar()
    )
    upcoming_events = (
        db.query(func.count(models.Event.event_id)).filter(models.Event.event_date >= today).scalar()
    )

    return {
        "total_students": total_students,
        "total_teachers": total_teachers,
        "total_classes": total_classes,
        "today_attendance": present_today,
        "staff_present_today": staff_present_today,
        "attendance_rate": round((present_today / total_students) * 100) if total_students else 0,
        "pending_fees": pending_fees,
        "pending_amount": float(pending_amount or 0),
        "collected_amount": float(collected_amount or 0),
        "upcoming_events": upcoming_events,
    }


# ---------------------------------------------------------------- classrooms
@router.get("/classrooms", response_model=list[schemas.ClassroomDetailOut])
def list_classrooms(db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    rows = db.query(models.Classroom).order_by(models.Classroom.class_name).all()
    out = []
    for c in rows:
        teacher = (
            db.query(models.Teacher).filter(models.Teacher.class_id == c.class_id).first()
        )
        count = db.query(func.count(models.Student.student_id)).filter(models.Student.class_id == c.class_id).scalar()
        out.append(
            schemas.ClassroomDetailOut(
                class_id=c.class_id,
                class_name=c.class_name,
                section=c.section,
                teacher_id=teacher.teacher_id if teacher else None,
                teacher_name=teacher.name if teacher else None,
                student_count=count or 0,
            )
        )
    return out


@router.post("/classrooms", response_model=schemas.ClassroomOut)
def create_classroom(payload: schemas.ClassroomCreate, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    classroom = models.Classroom(**payload.model_dump())
    db.add(classroom)
    db.commit()
    db.refresh(classroom)
    if payload.teacher_id:
        _assign_teacher(db, classroom.class_id, payload.teacher_id)
    return classroom


@router.put("/classrooms/{class_id}", response_model=schemas.ClassroomOut)
def update_classroom(class_id: int, payload: schemas.ClassroomUpdate, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    classroom = _get_or_404(db, models.Classroom, models.Classroom.class_id, class_id, "Class")
    data = payload.model_dump(exclude_unset=True)
    teacher_id = data.pop("teacher_id", "__unset__")
    for key, value in data.items():
        setattr(classroom, key, value)
    if teacher_id != "__unset__":
        _assign_teacher(db, class_id, teacher_id)
        classroom.teacher_id = teacher_id
    db.commit()
    db.refresh(classroom)
    return classroom


def _assign_teacher(db: Session, class_id: int, teacher_id: int | None):
    """One teacher per class: clear the previous holder, then assign the new one."""
    for t in db.query(models.Teacher).filter(models.Teacher.class_id == class_id).all():
        t.class_id = None
    if teacher_id:
        teacher = db.query(models.Teacher).filter(models.Teacher.teacher_id == teacher_id).first()
        if teacher:
            teacher.class_id = class_id
    db.commit()


@router.delete("/classrooms/{class_id}")
def delete_classroom(class_id: int, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    classroom = _get_or_404(db, models.Classroom, models.Classroom.class_id, class_id, "Class")
    students = db.query(func.count(models.Student.student_id)).filter(models.Student.class_id == class_id).scalar()
    if students:
        raise HTTPException(
            status_code=400,
            detail=f"{students} student(s) are still in this class. Move them first, then delete the class.",
        )
    for t in db.query(models.Teacher).filter(models.Teacher.class_id == class_id).all():
        t.class_id = None
    db.delete(classroom)
    db.commit()
    return {"message": "Class deleted"}


# ---------------------------------------------------------------- teachers
@router.get("/teachers", response_model=list[schemas.TeacherOut])
def list_teachers(db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    return db.query(models.Teacher).order_by(models.Teacher.name).all()


@router.post("/teachers", response_model=schemas.TeacherOut)
def create_teacher(payload: schemas.TeacherCreate, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    if _email_taken(db, models.Teacher, payload.email):
        raise HTTPException(status_code=400, detail="A teacher with that email already exists")

    employee_id = (payload.employee_id or "").strip() or _next_employee_id(db)
    if db.query(models.Teacher).filter(models.Teacher.employee_id == employee_id).first():
        raise HTTPException(status_code=400, detail=f"Staff ID {employee_id} is already taken")

    teacher = models.Teacher(
        name=payload.name,
        email=payload.email,
        password_hash=auth.hash_password(payload.password),
        employee_id=employee_id,
        phone=payload.phone,
        address=payload.address,
        profile_photo=payload.profile_photo,
        class_id=payload.class_id,
    )
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    if payload.class_id:
        _assign_teacher(db, payload.class_id, teacher.teacher_id)
    return teacher


def _next_employee_id(db: Session) -> str:
    existing = {r[0] for r in db.query(models.Teacher.employee_id).all() if r[0]}
    n = 1
    while f"TCH-{n:03d}" in existing:
        n += 1
    return f"TCH-{n:03d}"


@router.put("/teachers/{teacher_id}", response_model=schemas.TeacherOut)
def update_teacher(teacher_id: int, payload: schemas.TeacherUpdate, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    teacher = _get_or_404(db, models.Teacher, models.Teacher.teacher_id, teacher_id, "Teacher")
    data = payload.model_dump(exclude_unset=True)

    if "email" in data and _email_taken(db, models.Teacher, data["email"], teacher_id, models.Teacher.teacher_id):
        raise HTTPException(status_code=400, detail="Another teacher already uses that email")
    if data.get("employee_id"):
        clash = (
            db.query(models.Teacher)
            .filter(models.Teacher.employee_id == data["employee_id"], models.Teacher.teacher_id != teacher_id)
            .first()
        )
        if clash:
            raise HTTPException(status_code=400, detail=f"Staff ID {data['employee_id']} is already taken")

    password = data.pop("password", None)
    if password:
        teacher.password_hash = auth.hash_password(password)
    class_id = data.pop("class_id", "__unset__")

    for key, value in data.items():
        setattr(teacher, key, value)
    db.commit()

    if class_id != "__unset__":
        if class_id:
            _assign_teacher(db, class_id, teacher_id)
        else:
            teacher.class_id = None
            db.commit()

    db.refresh(teacher)
    return teacher


@router.delete("/teachers/{teacher_id}")
def delete_teacher(teacher_id: int, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    teacher = _get_or_404(db, models.Teacher, models.Teacher.teacher_id, teacher_id, "Teacher")
    db.query(models.TeacherAttendance).filter(models.TeacherAttendance.teacher_id == teacher_id).delete()
    db.query(models.Classroom).filter(models.Classroom.teacher_id == teacher_id).update({"teacher_id": None})
    db.delete(teacher)
    db.commit()
    return {"message": "Teacher removed"}


# ---------------------------------------------------------------- parents
@router.get("/parents", response_model=list[schemas.ParentOut])
def list_parents(db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    return db.query(models.Parent).order_by(models.Parent.name).all()


@router.post("/parents", response_model=schemas.ParentOut)
def create_parent(payload: schemas.ParentCreate, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    if _email_taken(db, models.Parent, payload.email):
        raise HTTPException(status_code=400, detail="A parent with that email already exists")
    parent = models.Parent(
        name=payload.name,
        email=payload.email,
        password_hash=auth.hash_password(payload.password),
        phone=payload.phone,
        address=payload.address,
        father_name=payload.father_name,
        father_phone=payload.father_phone,
        mother_name=payload.mother_name,
        mother_phone=payload.mother_phone,
    )
    db.add(parent)
    db.commit()
    db.refresh(parent)
    return parent


@router.put("/parents/{parent_id}", response_model=schemas.ParentOut)
def update_parent(parent_id: int, payload: schemas.ParentUpdate, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    parent = _get_or_404(db, models.Parent, models.Parent.parent_id, parent_id, "Parent")
    data = payload.model_dump(exclude_unset=True)
    if "email" in data and _email_taken(db, models.Parent, data["email"], parent_id, models.Parent.parent_id):
        raise HTTPException(status_code=400, detail="Another parent already uses that email")
    password = data.pop("password", None)
    if password:
        parent.password_hash = auth.hash_password(password)
    for key, value in data.items():
        setattr(parent, key, value)
    db.commit()
    db.refresh(parent)
    return parent


@router.delete("/parents/{parent_id}")
def delete_parent(parent_id: int, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    parent = _get_or_404(db, models.Parent, models.Parent.parent_id, parent_id, "Parent")
    linked = db.query(func.count(models.Student.student_id)).filter(models.Student.parent_id == parent_id).scalar()
    if linked:
        raise HTTPException(
            status_code=400,
            detail=f"{linked} student(s) are linked to this parent. Re-link or remove them first.",
        )
    db.query(models.Notification).filter(models.Notification.parent_id == parent_id).delete()
    db.delete(parent)
    db.commit()
    return {"message": "Parent removed"}


# ---------------------------------------------------------------- students
@router.get("/students", response_model=list[schemas.StudentDetailOut])
def list_students(db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    students = db.query(models.Student).order_by(models.Student.name).all()
    classes = {c.class_id: c for c in db.query(models.Classroom).all()}
    parents = {p.parent_id: p for p in db.query(models.Parent).all()}
    teachers_by_class = {t.class_id: t for t in db.query(models.Teacher).filter(models.Teacher.class_id.isnot(None)).all()}

    out = []
    for s in students:
        classroom = classes.get(s.class_id)
        parent = parents.get(s.parent_id)
        teacher = teachers_by_class.get(s.class_id)
        out.append(
            schemas.StudentDetailOut(
                student_id=s.student_id,
                roll_no=s.roll_no,
                name=s.name,
                dob=s.dob,
                gender=s.gender,
                parent_id=s.parent_id,
                class_id=s.class_id,
                profile_photo=s.profile_photo,
                class_name=classroom.class_name if classroom else None,
                section=classroom.section if classroom else None,
                teacher_name=teacher.name if teacher else None,
                parent_name=parent.name if parent else None,
                parent_phone=(parent.phone or parent.father_phone or parent.mother_phone) if parent else None,
            )
        )
    return out


@router.post("/students", response_model=schemas.StudentOut)
def create_student(payload: schemas.StudentCreate, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    student = models.Student(**payload.model_dump())
    student.roll_no = _next_roll_no(db, payload.class_id)
    if not student.admission_date:
        student.admission_date = date.today()
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


@router.put("/students/{student_id}", response_model=schemas.StudentOut)
def update_student(student_id: int, payload: schemas.StudentUpdate, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    student = _get_or_404(db, models.Student, models.Student.student_id, student_id, "Student")
    data = payload.model_dump(exclude_unset=True)
    moved_class = "class_id" in data and data["class_id"] != student.class_id
    for key, value in data.items():
        setattr(student, key, value)
    # Moving class re-issues the roll number so it still matches the class prefix.
    if moved_class:
        student.roll_no = _next_roll_no(db, student.class_id)
    db.commit()
    db.refresh(student)
    return student


@router.delete("/students/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    student = _get_or_404(db, models.Student, models.Student.student_id, student_id, "Student")
    for model, column in (
        (models.Attendance, models.Attendance.student_id),
        (models.Fee, models.Fee.student_id),
        (models.Reward, models.Reward.student_id),
        (models.QuizResult, models.QuizResult.student_id),
        (models.LearningProgress, models.LearningProgress.student_id),
        (models.LearningSession, models.LearningSession.student_id),
        (models.AIConversationLog, models.AIConversationLog.student_id),
        (models.Report, models.Report.student_id),
    ):
        db.query(model).filter(column == student_id).delete()
    db.delete(student)
    db.commit()
    return {"message": "Student removed"}


# ---------------------------------------------------------------- attendance
@router.get("/attendance", response_model=list[schemas.AttendanceRow])
def student_attendance(
    att_date: date,
    class_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    q = db.query(models.Attendance).filter(models.Attendance.att_date == att_date)
    if class_id:
        q = q.filter(models.Attendance.class_id == class_id)
    records = q.all()
    students = {s.student_id: s for s in db.query(models.Student).all()}
    return [
        schemas.AttendanceRow(
            attendance_id=r.attendance_id,
            student_id=r.student_id,
            class_id=r.class_id,
            att_date=r.att_date,
            status=r.status,
            note=r.note,
            marked_by=r.marked_by,
            student_name=students.get(r.student_id).name if students.get(r.student_id) else None,
            roll_no=students.get(r.student_id).roll_no if students.get(r.student_id) else None,
        )
        for r in records
    ]


@router.post("/attendance", response_model=schemas.AttendanceOut)
def upsert_student_attendance(payload: schemas.AttendanceCreate, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    """An admin can correct any class's attendance, on any date."""
    record = (
        db.query(models.Attendance)
        .filter(models.Attendance.student_id == payload.student_id, models.Attendance.att_date == payload.att_date)
        .first()
    )
    if record:
        record.status = payload.status
        record.note = payload.note
        record.class_id = payload.class_id
    else:
        record = models.Attendance(**payload.model_dump())
        db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/teacher-attendance", response_model=list[schemas.TeacherAttendanceOut])
def staff_attendance(att_date: date, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    return db.query(models.TeacherAttendance).filter(models.TeacherAttendance.att_date == att_date).all()


@router.post("/teacher-attendance", response_model=schemas.TeacherAttendanceOut)
def upsert_staff_attendance(payload: schemas.TeacherAttendanceCreate, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    record = (
        db.query(models.TeacherAttendance)
        .filter(
            models.TeacherAttendance.teacher_id == payload.teacher_id,
            models.TeacherAttendance.att_date == payload.att_date,
        )
        .first()
    )
    if record:
        record.status = payload.status
        record.note = payload.note
    else:
        record = models.TeacherAttendance(**payload.model_dump(), marked_by=int(current_user["sub"]))
        db.add(record)
    db.commit()
    db.refresh(record)
    return record


# ---------------------------------------------------------------- fees
@router.get("/fees", response_model=list[schemas.FeeRow])
def list_fees(db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    fees = db.query(models.Fee).order_by(models.Fee.due_date.desc()).all()
    students = {s.student_id: s.name for s in db.query(models.Student).all()}
    return [
        schemas.FeeRow(
            fee_id=f.fee_id,
            student_id=f.student_id,
            title=f.title,
            amount=float(f.amount or 0),
            due_date=f.due_date,
            status=f.status,
            payment_date=f.payment_date,
            paid_via=f.paid_via,
            payment_ref=f.payment_ref,
            student_name=students.get(f.student_id),
        )
        for f in fees
    ]


@router.post("/fees", response_model=schemas.FeeOut)
def create_fee(payload: schemas.FeeCreate, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    fee = models.Fee(**payload.model_dump())
    db.add(fee)
    db.commit()
    db.refresh(fee)
    return fee


@router.put("/fees/{fee_id}", response_model=schemas.FeeOut)
def update_fee(fee_id: int, payload: schemas.FeeUpdate, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    fee = _get_or_404(db, models.Fee, models.Fee.fee_id, fee_id, "Fee")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(fee, key, value)
    if data.get("status") == "paid" and not fee.payment_date:
        fee.payment_date = date.today()
        fee.paid_via = fee.paid_via or "cash"
    if data.get("status") in ("pending", "overdue"):
        fee.payment_date = None
        fee.paid_via = None
        fee.payment_ref = None
    db.commit()
    db.refresh(fee)
    return fee


@router.delete("/fees/{fee_id}")
def delete_fee(fee_id: int, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    fee = _get_or_404(db, models.Fee, models.Fee.fee_id, fee_id, "Fee")
    db.delete(fee)
    db.commit()
    return {"message": "Fee removed"}


# ---------------------------------------------------------------- events
@router.get("/events", response_model=list[schemas.EventOut])
def list_events(db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    return db.query(models.Event).order_by(models.Event.event_date.desc()).all()


@router.post("/events", response_model=schemas.EventOut)
def create_event(payload: schemas.EventCreate, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    event = models.Event(**payload.model_dump(), created_by=int(current_user["sub"]))
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.put("/events/{event_id}", response_model=schemas.EventOut)
def update_event(event_id: int, payload: schemas.EventUpdate, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    event = _get_or_404(db, models.Event, models.Event.event_id, event_id, "Event")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(event, key, value)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/events/{event_id}")
def delete_event(event_id: int, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    event = _get_or_404(db, models.Event, models.Event.event_id, event_id, "Event")
    db.delete(event)
    db.commit()
    return {"message": "Event removed"}


# ---------------------------------------------------------------- settings
def get_settings_row(db: Session) -> models.SchoolSetting:
    row = db.query(models.SchoolSetting).first()
    if not row:
        row = models.SchoolSetting(school_name="Sprout Preschool")
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.get("/settings", response_model=schemas.SettingsOut)
def read_settings(db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    return get_settings_row(db)


@router.put("/settings", response_model=schemas.SettingsOut)
def update_settings(payload: schemas.SettingsUpdate, db: Session = Depends(get_db), current_user: dict = Depends(require_admin)):
    row = get_settings_row(db)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row
