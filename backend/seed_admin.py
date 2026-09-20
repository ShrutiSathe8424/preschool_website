"""
First-run setup.

Creates the initial Admin account, the school settings row, and fills in any
missing roll numbers / staff IDs left over from an earlier version.

    cd backend
    python seed_admin.py            # admin only
    python seed_admin.py --demo     # admin + a small demo school to click around
"""
import re
import sys
from datetime import date, timedelta

from app.database import SessionLocal, Base, engine
from app import models, auth

Base.metadata.create_all(bind=engine)
db = SessionLocal()

ADMIN_EMAIL = "admin@school.com"
ADMIN_PASSWORD = "admin123"


def ensure_admin():
    existing = db.query(models.Admin).filter(models.Admin.email == ADMIN_EMAIL).first()
    if existing:
        print(f"Admin already exists: {existing.email}")
        return existing
    admin = models.Admin(
        name="Super Admin",
        email=ADMIN_EMAIL,
        password_hash=auth.hash_password(ADMIN_PASSWORD),
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    print(f"Admin created -> email: {ADMIN_EMAIL} | password: {ADMIN_PASSWORD}")
    print("Change this password after your first login.")
    return admin


def ensure_settings():
    if db.query(models.SchoolSetting).first():
        return
    db.add(
        models.SchoolSetting(
            school_name="Sprout Preschool",
            contact_email="office@sproutpreschool.in",
            payment_note="Scan the QR in any UPI app, then enter the reference number here.",
        )
    )
    db.commit()
    print("School settings row created.")


def backfill_ids():
    """Older rows predate roll numbers and staff IDs — give them one."""
    n = 0
    for teacher in db.query(models.Teacher).filter(models.Teacher.employee_id.is_(None)).all():
        taken = {t[0] for t in db.query(models.Teacher.employee_id).all() if t[0]}
        i = 1
        while f"TCH-{i:03d}" in taken:
            i += 1
        teacher.employee_id = f"TCH-{i:03d}"
        db.commit()
        n += 1

    m = 0
    for student in db.query(models.Student).filter(models.Student.roll_no.is_(None)).all():
        classroom = db.query(models.Classroom).filter(models.Classroom.class_id == student.class_id).first()
        letters = re.sub(r"[^A-Za-z]", "", classroom.class_name if classroom else "")[:3].upper() or "STU"
        prefix = f"{letters}-{re.sub(r'[^A-Za-z0-9]', '', classroom.section)[:2].upper()}" if classroom and classroom.section else letters
        taken = {r[0] for r in db.query(models.Student.roll_no).all() if r[0]}
        i = 1
        while f"{prefix}-{i:03d}" in taken:
            i += 1
        student.roll_no = f"{prefix}-{i:03d}"
        db.commit()
        m += 1

    if n or m:
        print(f"Back-filled {n} staff ID(s) and {m} roll number(s).")


def seed_demo(admin):
    if db.query(models.Classroom).first():
        print("Demo data skipped — the school already has classes.")
        return

    classroom = models.Classroom(class_name="Nursery", section="A")
    db.add(classroom)
    db.commit()
    db.refresh(classroom)

    teacher = models.Teacher(
        employee_id="TCH-001",
        name="Meera Shah",
        email="teacher@school.com",
        password_hash=auth.hash_password("teacher123"),
        phone="9876543210",
        class_id=classroom.class_id,
    )
    parent = models.Parent(
        name="Rohan Verma",
        email="parent@school.com",
        password_hash=auth.hash_password("parent123"),
        phone="9812345678",
        father_name="Rohan Verma",
        father_phone="9812345678",
        mother_name="Anita Verma",
        mother_phone="9812345679",
        address="14 Hill Road, Mumbai",
    )
    db.add_all([teacher, parent])
    db.commit()
    db.refresh(teacher)
    db.refresh(parent)

    classroom.teacher_id = teacher.teacher_id
    student = models.Student(
        roll_no="NUR-A-001",
        name="Aarav Verma",
        parent_id=parent.parent_id,
        class_id=classroom.class_id,
        admission_date=date.today() - timedelta(days=60),
        gender="male",
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    for i in range(10):
        day = date.today() - timedelta(days=i)
        if day.weekday() >= 5:
            continue
        db.add(
            models.Attendance(
                student_id=student.student_id,
                class_id=classroom.class_id,
                att_date=day,
                status="absent" if i == 4 else ("late" if i == 2 else "present"),
                marked_by=teacher.teacher_id,
            )
        )
    db.add(
        models.Fee(
            student_id=student.student_id,
            title="Term 2 fee",
            amount=6500,
            due_date=date.today() + timedelta(days=12),
            status="pending",
        )
    )
    db.add(
        models.Event(
            title="Annual Sports Day",
            description="Races, relays and a parents' game on the main field.",
            event_date=date.today() + timedelta(days=21),
            venue="School ground",
            created_by=admin.admin_id,
        )
    )
    db.add(
        models.LearningContent(
            title="Phonics song: A to E",
            description="A short sing-along for the first five letters.",
            category="Alphabets",
            emoji="\U0001F524",
            content_type="video",
            media_url="https://www.w3schools.com/html/mov_bbb.mp4",
            class_id=classroom.class_id,
            created_by_type="admin",
            created_by_id=admin.admin_id,
        )
    )
    db.commit()
    print("Demo school created:")
    print("  teacher@school.com / teacher123")
    print("  parent@school.com  / parent123")


admin = ensure_admin()
ensure_settings()
backfill_ids()
if "--demo" in sys.argv:
    seed_demo(admin)

db.close()
