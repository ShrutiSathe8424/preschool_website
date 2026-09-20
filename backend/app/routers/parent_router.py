from collections import defaultdict
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/api/parent", tags=["Parent"])
require_parent = auth.require_role("parent")


def _verify_child_belongs_to_parent(db: Session, student_id: int, parent_id: int) -> models.Student:
    student = db.query(models.Student).filter(models.Student.student_id == student_id).first()
    if not student or student.parent_id != parent_id:
        raise HTTPException(status_code=403, detail="This student is not linked to your account")
    return student


@router.get("/children", response_model=list[schemas.StudentDetailOut])
def my_children(db: Session = Depends(get_db), current_user: dict = Depends(require_parent)):
    parent_id = int(current_user["sub"])
    students = db.query(models.Student).filter(models.Student.parent_id == parent_id).all()
    out = []
    for s in students:
        classroom = db.query(models.Classroom).filter(models.Classroom.class_id == s.class_id).first()
        teacher = db.query(models.Teacher).filter(models.Teacher.class_id == s.class_id).first()
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
            )
        )
    return out


# ---------------------------------------------------------------- attendance
@router.get("/attendance/{student_id}", response_model=list[schemas.AttendanceOut])
def child_attendance(student_id: int, db: Session = Depends(get_db), current_user: dict = Depends(require_parent)):
    _verify_child_belongs_to_parent(db, student_id, int(current_user["sub"]))
    return (
        db.query(models.Attendance)
        .filter(models.Attendance.student_id == student_id)
        .order_by(models.Attendance.att_date.desc())
        .all()
    )


@router.get("/attendance/{student_id}/analysis", response_model=schemas.AttendanceAnalysis)
def child_attendance_analysis(student_id: int, db: Session = Depends(get_db), current_user: dict = Depends(require_parent)):
    """Attendance rolled up the way a parent reads it: a rate, a streak, and a month-by-month bar."""
    _verify_child_belongs_to_parent(db, student_id, int(current_user["sub"]))
    records = (
        db.query(models.Attendance)
        .filter(models.Attendance.student_id == student_id)
        .order_by(models.Attendance.att_date.desc())
        .all()
    )

    counts = {"present": 0, "absent": 0, "late": 0}
    buckets: dict[str, dict[str, int]] = defaultdict(lambda: {"present": 0, "absent": 0, "late": 0})
    for r in records:
        status = (r.status or "").lower()
        if status in counts:
            counts[status] += 1
            buckets[r.att_date.strftime("%Y-%m")][status] += 1

    total = len(records)
    # A late arrival still counts as attending, just not on time.
    attended = counts["present"] + counts["late"]
    percentage = round((attended / total) * 100, 1) if total else 0.0

    streak = 0
    for r in records:  # already newest-first
        if (r.status or "").lower() in ("present", "late"):
            streak += 1
        else:
            break

    monthly = [
        schemas.MonthlyAttendance(month=month, **values)
        for month, values in sorted(buckets.items())
    ][-6:]

    return schemas.AttendanceAnalysis(
        student_id=student_id,
        total_days=total,
        present=counts["present"],
        absent=counts["absent"],
        late=counts["late"],
        percentage=percentage,
        current_streak=streak,
        monthly=monthly,
        recent=records[:14],
    )


# ---------------------------------------------------------------- class feed
@router.get("/homework/{student_id}", response_model=list[schemas.HomeworkOut])
def child_homework(student_id: int, db: Session = Depends(get_db), current_user: dict = Depends(require_parent)):
    student = _verify_child_belongs_to_parent(db, student_id, int(current_user["sub"]))
    return (
        db.query(models.Homework)
        .filter(models.Homework.class_id == student.class_id)
        .order_by(models.Homework.due_date.desc())
        .all()
    )


@router.get("/activities/{student_id}", response_model=list[schemas.ActivityOut])
def child_activities(student_id: int, db: Session = Depends(get_db), current_user: dict = Depends(require_parent)):
    student = _verify_child_belongs_to_parent(db, student_id, int(current_user["sub"]))
    return (
        db.query(models.Activity)
        .filter(models.Activity.class_id == student.class_id)
        .order_by(models.Activity.act_date.desc())
        .all()
    )


@router.get("/events", response_model=list[schemas.EventOut])
def school_events(db: Session = Depends(get_db), current_user: dict = Depends(require_parent)):
    return db.query(models.Event).order_by(models.Event.event_date.desc()).limit(40).all()


@router.get("/notifications")
def my_notifications(db: Session = Depends(get_db), current_user: dict = Depends(require_parent)):
    parent_id = int(current_user["sub"])
    notes = (
        db.query(models.Notification)
        .filter(models.Notification.parent_id == parent_id)
        .order_by(models.Notification.sent_date.desc())
        .all()
    )
    return [
        {
            "notification_id": n.notification_id,
            "type": n.type,
            "message": n.message,
            "sent_date": n.sent_date,
            "is_read": n.is_read,
        }
        for n in notes
    ]


# ---------------------------------------------------------------- fees
@router.get("/fees/{student_id}", response_model=list[schemas.FeeOut])
def child_fees(student_id: int, db: Session = Depends(get_db), current_user: dict = Depends(require_parent)):
    _verify_child_belongs_to_parent(db, student_id, int(current_user["sub"]))
    return (
        db.query(models.Fee)
        .filter(models.Fee.student_id == student_id)
        .order_by(models.Fee.due_date.desc())
        .all()
    )


@router.get("/payment-info", response_model=schemas.SettingsOut)
def payment_info(db: Session = Depends(get_db), current_user: dict = Depends(require_parent)):
    """The QR code and UPI ID the admin uploaded, shown on the pay screen."""
    row = db.query(models.SchoolSetting).first()
    if not row:
        raise HTTPException(status_code=404, detail="The school hasn't added payment details yet")
    return row


@router.post("/fees/{fee_id}/pay", response_model=schemas.FeeOut)
def pay_fee(fee_id: int, payload: schemas.FeePayment, db: Session = Depends(get_db), current_user: dict = Depends(require_parent)):
    """
    Records a payment the parent made against the school's QR / UPI ID.
    The school confirms it from the Admin fees screen; until then the payment
    reference is stored so both sides can match it.
    """
    fee = db.query(models.Fee).filter(models.Fee.fee_id == fee_id).first()
    if not fee:
        raise HTTPException(status_code=404, detail="Fee not found")
    _verify_child_belongs_to_parent(db, fee.student_id, int(current_user["sub"]))
    if fee.status == "paid":
        raise HTTPException(status_code=400, detail="This fee is already marked paid")
    if not payload.payment_ref.strip():
        raise HTTPException(status_code=400, detail="Enter the UPI reference number from your payment app")

    fee.status = "paid"
    fee.paid_via = payload.paid_via
    fee.payment_ref = payload.payment_ref.strip()
    fee.payment_date = date.today()
    db.commit()
    db.refresh(fee)
    return fee


# ---------------------------------------------------------------- Child Mode PIN
@router.post("/child-pin")
def set_child_pin(payload: schemas.SetChildPin, db: Session = Depends(get_db), current_user: dict = Depends(require_parent)):
    if not (payload.pin.isdigit() and len(payload.pin) == 4):
        raise HTTPException(status_code=400, detail="PIN must be exactly 4 digits")
    parent_id = int(current_user["sub"])
    parent = db.query(models.Parent).filter(models.Parent.parent_id == parent_id).first()
    parent.child_pin_hash = auth.hash_password(payload.pin)
    db.commit()
    return {"message": "Child Mode PIN saved"}


@router.get("/child-pin/status")
def child_pin_status(db: Session = Depends(get_db), current_user: dict = Depends(require_parent)):
    parent_id = int(current_user["sub"])
    parent = db.query(models.Parent).filter(models.Parent.parent_id == parent_id).first()
    return {"pin_set": bool(parent.child_pin_hash)}


# ---------------------------------------------------------------- report
@router.get("/report/{student_id}", response_model=schemas.ParentReport)
def get_report(student_id: int, db: Session = Depends(get_db), current_user: dict = Depends(require_parent)):
    _verify_child_belongs_to_parent(db, student_id, int(current_user["sub"]))

    total_minutes = (
        db.query(func.coalesce(func.sum(models.LearningSession.duration_minutes), 0))
        .filter(models.LearningSession.student_id == student_id)
        .scalar()
    )
    lessons_completed = (
        db.query(func.coalesce(func.sum(models.LearningProgress.completed_lessons), 0))
        .filter(models.LearningProgress.student_id == student_id)
        .scalar()
    )
    quizzes_attempted = (
        db.query(func.count(models.QuizResult.quiz_id))
        .filter(models.QuizResult.student_id == student_id)
        .scalar()
    )
    rewards_earned = (
        db.query(func.count(models.Reward.reward_id))
        .filter(models.Reward.student_id == student_id)
        .scalar()
    )
    recent_rewards = (
        db.query(models.Reward)
        .filter(models.Reward.student_id == student_id)
        .order_by(models.Reward.earned_date.desc())
        .limit(5)
        .all()
    )

    return schemas.ParentReport(
        student_id=student_id,
        total_minutes_learned=total_minutes,
        lessons_completed=lessons_completed,
        quizzes_attempted=quizzes_attempted,
        rewards_earned=rewards_earned,
        recent_rewards=recent_rewards,
    )
