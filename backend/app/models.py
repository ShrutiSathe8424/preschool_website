from sqlalchemy import (
    Column, Integer, String, Date, DateTime, Boolean, DECIMAL, ForeignKey, Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class Admin(Base):
    __tablename__ = "admins"

    admin_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="admin")
    phone = Column(String(20))
    profile_photo = Column(String(255))


class Teacher(Base):
    __tablename__ = "teachers"

    teacher_id = Column(Integer, primary_key=True, index=True)
    # Human-readable staff ID printed on ID cards, e.g. "TCH-004". Unique.
    employee_id = Column(String(30), unique=True, nullable=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    phone = Column(String(20))
    address = Column(String(255))
    profile_photo = Column(String(255))
    class_id = Column(Integer, ForeignKey("classrooms.class_id"), nullable=True)


class Parent(Base):
    __tablename__ = "parents"

    parent_id = Column(Integer, primary_key=True, index=True)
    # `name` stays as the account/display name so existing logins keep working.
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    phone = Column(String(20))
    address = Column(String(255))
    profile_photo = Column(String(255))
    # Both guardians can be recorded; either may be the primary contact.
    father_name = Column(String(100))
    father_phone = Column(String(20))
    mother_name = Column(String(100))
    mother_phone = Column(String(20))
    # 4-digit PIN (hashed) used to exit Child Mode on a shared device
    child_pin_hash = Column(String(255), nullable=True)

    students = relationship("Student", back_populates="parent")


class Classroom(Base):
    __tablename__ = "classrooms"

    class_id = Column(Integer, primary_key=True, index=True)
    class_name = Column(String(100), nullable=False)
    section = Column(String(20))
    # teachers.class_id and classrooms.teacher_id point at each other, so this
    # constraint is added with ALTER after both tables exist.
    teacher_id = Column(Integer, ForeignKey("teachers.teacher_id", use_alter=True, name="fk_classroom_teacher"), nullable=True)

    students = relationship("Student", back_populates="classroom")


class Student(Base):
    __tablename__ = "students"

    student_id = Column(Integer, primary_key=True, index=True)
    # Auto-generated on enrolment, unique across the school, e.g. "NUR-A-007".
    roll_no = Column(String(30), unique=True, nullable=True)
    name = Column(String(100), nullable=False)
    dob = Column(Date)
    gender = Column(String(20))
    parent_id = Column(Integer, ForeignKey("parents.parent_id"))
    class_id = Column(Integer, ForeignKey("classrooms.class_id"))
    admission_date = Column(Date)
    profile_photo = Column(String(255))
    login_pin = Column(String(255))

    parent = relationship("Parent", back_populates="students")
    classroom = relationship("Classroom", back_populates="students")


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("student_id", "att_date", name="uq_student_day"),)

    attendance_id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.student_id"))
    class_id = Column(Integer, ForeignKey("classrooms.class_id"))
    att_date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False)  # present / absent / late
    note = Column(String(255))
    marked_by = Column(Integer, ForeignKey("teachers.teacher_id"))
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class TeacherAttendance(Base):
    """Staff attendance, marked by an admin."""
    __tablename__ = "teacher_attendance"
    __table_args__ = (UniqueConstraint("teacher_id", "att_date", name="uq_teacher_day"),)

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("teachers.teacher_id"))
    att_date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False)  # present / absent / leave / late
    note = Column(String(255))
    marked_by = Column(Integer, ForeignKey("admins.admin_id"))
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Activity(Base):
    __tablename__ = "activities"

    activity_id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classrooms.class_id"))
    teacher_id = Column(Integer, ForeignKey("teachers.teacher_id"))
    title = Column(String(150), nullable=False)
    description = Column(Text)
    act_date = Column(Date)
    photo_url = Column(String(255))


class Homework(Base):
    __tablename__ = "homework"

    homework_id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classrooms.class_id"))
    teacher_id = Column(Integer, ForeignKey("teachers.teacher_id"))
    title = Column(String(150), nullable=False)
    description = Column(Text)
    due_date = Column(Date)
    file_url = Column(String(255))


class Fee(Base):
    __tablename__ = "fees"

    fee_id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.student_id"))
    title = Column(String(150), default="Term fee")
    amount = Column(DECIMAL(10, 2), nullable=False)
    due_date = Column(Date)
    status = Column(String(20), default="pending")  # pending / paid / overdue
    payment_date = Column(Date, nullable=True)
    paid_via = Column(String(30), nullable=True)  # upi / cash / card / bank
    payment_ref = Column(String(100), nullable=True)
    receipt_url = Column(String(255), nullable=True)


class Event(Base):
    __tablename__ = "events"

    event_id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    description = Column(Text)
    event_date = Column(Date, nullable=False)
    venue = Column(String(150))
    photo_url = Column(String(255))
    created_by = Column(Integer, ForeignKey("admins.admin_id"))


class SchoolSetting(Base):
    """Single-row table holding school-wide settings, incl. the fee payment QR."""
    __tablename__ = "school_settings"

    id = Column(Integer, primary_key=True, index=True)
    school_name = Column(String(150), default="Sprout Preschool")
    contact_email = Column(String(150))
    contact_phone = Column(String(20))
    upi_id = Column(String(120))
    payment_qr_url = Column(String(255))
    payment_note = Column(String(255))


class LearningContent(Base):
    """A tile inside Child Mode — a video, rhyme or lesson added by staff."""
    __tablename__ = "learning_content"

    content_id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    description = Column(Text)
    category = Column(String(50), default="Lesson")  # Alphabets / Numbers / Rhymes ...
    emoji = Column(String(10), default="\U0001F3AC")
    content_type = Column(String(20), default="video")  # video / link / image
    media_url = Column(String(500))
    class_id = Column(Integer, ForeignKey("classrooms.class_id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_by_type = Column(String(20))  # admin / teacher
    created_by_id = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"

    notification_id = Column(Integer, primary_key=True, index=True)
    parent_id = Column(Integer, ForeignKey("parents.parent_id"))
    type = Column(String(50))  # homework / attendance / fee / event / holiday
    message = Column(String(255), nullable=False)
    sent_date = Column(DateTime, server_default=func.now())
    is_read = Column(Boolean, default=False)


class Report(Base):
    __tablename__ = "reports"

    report_id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.student_id"))
    term = Column(String(50))
    generated_date = Column(DateTime, server_default=func.now())
    file_url = Column(String(255), nullable=True)


class LearningProgress(Base):
    __tablename__ = "learning_progress"

    progress_id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.student_id"))
    module_name = Column(String(100))
    completed_lessons = Column(Integer, default=0)
    quiz_score = Column(Integer, default=0)
    weak_areas = Column(String(255), nullable=True)
    last_updated = Column(DateTime, onupdate=func.now(), server_default=func.now())


class QuizResult(Base):
    __tablename__ = "quiz_results"

    quiz_id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.student_id"))
    quiz_name = Column(String(150))
    score = Column(Integer)
    quiz_date = Column(DateTime, server_default=func.now())
    attempts = Column(Integer, default=1)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    message_id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, nullable=False)
    sender_type = Column(String(20), nullable=False)
    receiver_id = Column(Integer, nullable=False)
    receiver_type = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    timestamp = Column(DateTime, server_default=func.now())


class AIConversationLog(Base):
    __tablename__ = "ai_conversation_logs"

    log_id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.student_id"), nullable=True)
    parent_id = Column(Integer, ForeignKey("parents.parent_id"), nullable=True)
    user_type = Column(String(20))
    query = Column(Text)
    response = Column(Text)
    timestamp = Column(DateTime, server_default=func.now())


class LearningSession(Base):
    __tablename__ = "learning_sessions"

    session_id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.student_id"))
    start_time = Column(DateTime, server_default=func.now())
    end_time = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, default=0)
    focus_breaks = Column(Integer, default=0)


class Reward(Base):
    __tablename__ = "rewards"

    reward_id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.student_id"))
    reward_type = Column(String(30))
    reward_name = Column(String(150))
    source = Column(String(30))
    earned_date = Column(DateTime, server_default=func.now())
