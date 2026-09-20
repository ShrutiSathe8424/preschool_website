from pydantic import BaseModel, EmailStr
from datetime import date, datetime
from typing import Optional


# ---------- Auth ----------
class UserLogin(BaseModel):
    email: EmailStr
    password: str
    role: str  # admin / teacher / parent


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    name: str
    profile_photo: Optional[str] = None


class MeOut(BaseModel):
    user_id: int
    role: str
    name: str
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    profile_photo: Optional[str] = None
    employee_id: Optional[str] = None
    father_name: Optional[str] = None
    father_phone: Optional[str] = None
    mother_name: Optional[str] = None
    mother_phone: Optional[str] = None
    class_id: Optional[int] = None


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    profile_photo: Optional[str] = None
    father_name: Optional[str] = None
    father_phone: Optional[str] = None
    mother_name: Optional[str] = None
    mother_phone: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


# ---------- Admin ----------
class AdminCreate(BaseModel):
    name: str
    email: EmailStr
    password: str


class AdminOut(BaseModel):
    admin_id: int
    name: str
    email: EmailStr

    class Config:
        from_attributes = True


# ---------- Teacher ----------
class TeacherCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    employee_id: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    profile_photo: Optional[str] = None
    class_id: Optional[int] = None


class TeacherUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    employee_id: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    profile_photo: Optional[str] = None
    class_id: Optional[int] = None


class TeacherOut(BaseModel):
    teacher_id: int
    employee_id: Optional[str] = None
    name: str
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    profile_photo: Optional[str] = None
    class_id: Optional[int] = None

    class Config:
        from_attributes = True


# ---------- Parent ----------
class ParentCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None
    address: Optional[str] = None
    father_name: Optional[str] = None
    father_phone: Optional[str] = None
    mother_name: Optional[str] = None
    mother_phone: Optional[str] = None


class ParentUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    father_name: Optional[str] = None
    father_phone: Optional[str] = None
    mother_name: Optional[str] = None
    mother_phone: Optional[str] = None


class ParentOut(BaseModel):
    parent_id: int
    name: str
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    father_name: Optional[str] = None
    father_phone: Optional[str] = None
    mother_name: Optional[str] = None
    mother_phone: Optional[str] = None
    profile_photo: Optional[str] = None

    class Config:
        from_attributes = True


# ---------- Student ----------
class StudentCreate(BaseModel):
    name: str
    dob: Optional[date] = None
    gender: Optional[str] = None
    parent_id: Optional[int] = None
    class_id: Optional[int] = None
    admission_date: Optional[date] = None
    profile_photo: Optional[str] = None


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    dob: Optional[date] = None
    gender: Optional[str] = None
    parent_id: Optional[int] = None
    class_id: Optional[int] = None
    admission_date: Optional[date] = None
    profile_photo: Optional[str] = None


class StudentOut(BaseModel):
    student_id: int
    roll_no: Optional[str] = None
    name: str
    dob: Optional[date] = None
    gender: Optional[str] = None
    parent_id: Optional[int] = None
    class_id: Optional[int] = None
    profile_photo: Optional[str] = None

    class Config:
        from_attributes = True


class StudentDetailOut(StudentOut):
    """Student row joined with the names an admin actually wants to read."""
    class_name: Optional[str] = None
    section: Optional[str] = None
    teacher_name: Optional[str] = None
    parent_name: Optional[str] = None
    parent_phone: Optional[str] = None


# ---------- Classroom ----------
class ClassroomCreate(BaseModel):
    class_name: str
    section: Optional[str] = None
    teacher_id: Optional[int] = None


class ClassroomUpdate(BaseModel):
    class_name: Optional[str] = None
    section: Optional[str] = None
    teacher_id: Optional[int] = None


class ClassroomOut(BaseModel):
    class_id: int
    class_name: str
    section: Optional[str] = None
    teacher_id: Optional[int] = None

    class Config:
        from_attributes = True


class ClassroomDetailOut(ClassroomOut):
    teacher_name: Optional[str] = None
    student_count: int = 0


# ---------- Attendance ----------
class AttendanceCreate(BaseModel):
    student_id: int
    class_id: int
    att_date: date
    status: str
    note: Optional[str] = None


class AttendanceOut(BaseModel):
    attendance_id: int
    student_id: int
    class_id: Optional[int] = None
    att_date: date
    status: str
    note: Optional[str] = None
    marked_by: Optional[int] = None

    class Config:
        from_attributes = True


class AttendanceRow(AttendanceOut):
    student_name: Optional[str] = None
    roll_no: Optional[str] = None


class TeacherAttendanceCreate(BaseModel):
    teacher_id: int
    att_date: date
    status: str
    note: Optional[str] = None


class TeacherAttendanceOut(BaseModel):
    id: int
    teacher_id: int
    att_date: date
    status: str
    note: Optional[str] = None

    class Config:
        from_attributes = True


class MonthlyAttendance(BaseModel):
    month: str  # "2026-09"
    present: int
    absent: int
    late: int


class AttendanceAnalysis(BaseModel):
    student_id: int
    total_days: int
    present: int
    absent: int
    late: int
    percentage: float
    current_streak: int
    monthly: list[MonthlyAttendance]
    recent: list[AttendanceOut]


# ---------- Fees ----------
class FeeCreate(BaseModel):
    student_id: int
    title: str = "Term fee"
    amount: float
    due_date: Optional[date] = None
    status: str = "pending"


class FeeUpdate(BaseModel):
    title: Optional[str] = None
    amount: Optional[float] = None
    due_date: Optional[date] = None
    status: Optional[str] = None


class FeeOut(BaseModel):
    fee_id: int
    student_id: int
    title: Optional[str] = None
    amount: float
    due_date: Optional[date] = None
    status: str
    payment_date: Optional[date] = None
    paid_via: Optional[str] = None
    payment_ref: Optional[str] = None

    class Config:
        from_attributes = True


class FeeRow(FeeOut):
    student_name: Optional[str] = None


class FeePayment(BaseModel):
    paid_via: str = "upi"
    payment_ref: str


# ---------- Events ----------
class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    event_date: date
    venue: Optional[str] = None
    photo_url: Optional[str] = None


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    event_date: Optional[date] = None
    venue: Optional[str] = None
    photo_url: Optional[str] = None


class EventOut(BaseModel):
    event_id: int
    title: str
    description: Optional[str] = None
    event_date: date
    venue: Optional[str] = None
    photo_url: Optional[str] = None

    class Config:
        from_attributes = True


# ---------- School settings ----------
class SettingsUpdate(BaseModel):
    school_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    upi_id: Optional[str] = None
    payment_qr_url: Optional[str] = None
    payment_note: Optional[str] = None


class SettingsOut(BaseModel):
    school_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    upi_id: Optional[str] = None
    payment_qr_url: Optional[str] = None
    payment_note: Optional[str] = None

    class Config:
        from_attributes = True


# ---------- Learning content (Child Mode) ----------
class ContentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str = "Lesson"
    emoji: Optional[str] = None
    content_type: str = "video"
    media_url: str
    class_id: Optional[int] = None
    is_active: bool = True


class ContentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    emoji: Optional[str] = None
    content_type: Optional[str] = None
    media_url: Optional[str] = None
    class_id: Optional[int] = None
    is_active: Optional[bool] = None


class ContentOut(BaseModel):
    content_id: int
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    emoji: Optional[str] = None
    content_type: Optional[str] = None
    media_url: Optional[str] = None
    class_id: Optional[int] = None
    is_active: Optional[bool] = True

    class Config:
        from_attributes = True


# ---------- Homework ----------
class HomeworkCreate(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: date
    class_id: int
    file_url: Optional[str] = None


class HomeworkUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[date] = None
    file_url: Optional[str] = None


class HomeworkOut(BaseModel):
    homework_id: int
    title: str
    description: Optional[str] = None
    due_date: Optional[date] = None
    class_id: Optional[int] = None
    file_url: Optional[str] = None

    class Config:
        from_attributes = True


# ---------- Activity ----------
class ActivityCreate(BaseModel):
    title: str
    description: Optional[str] = None
    act_date: date
    class_id: int
    photo_url: Optional[str] = None


class ActivityUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    act_date: Optional[date] = None
    photo_url: Optional[str] = None


class ActivityOut(BaseModel):
    activity_id: int
    title: str
    description: Optional[str] = None
    act_date: Optional[date] = None
    class_id: Optional[int] = None
    photo_url: Optional[str] = None

    class Config:
        from_attributes = True


# ---------- Child Mode: PIN ----------
class SetChildPin(BaseModel):
    pin: str


class VerifyChildPin(BaseModel):
    student_id: int
    pin: str


class VerifyChildPinResponse(BaseModel):
    valid: bool


# ---------- Child Mode: sessions ----------
class SessionStart(BaseModel):
    student_id: int


class SessionStartResponse(BaseModel):
    session_id: int
    start_time: datetime


class SessionEnd(BaseModel):
    session_id: int
    focus_breaks: int = 0


class SessionEndResponse(BaseModel):
    session_id: int
    duration_minutes: int
    reward_earned: Optional[str] = None


class FocusBreakPing(BaseModel):
    session_id: int


class QuizSubmit(BaseModel):
    student_id: int
    quiz_name: str
    score: int


class ProgressUpdate(BaseModel):
    module_name: str
    completed_lessons: int


# ---------- Rewards / reports ----------
class RewardOut(BaseModel):
    reward_id: int
    reward_type: str
    reward_name: str
    source: str
    earned_date: datetime

    class Config:
        from_attributes = True


class ParentReport(BaseModel):
    student_id: int
    total_minutes_learned: int
    lessons_completed: int
    quizzes_attempted: int
    rewards_earned: int
    recent_rewards: list[RewardOut]


# ---------- AI Learning Buddy ----------
class AIChatRequest(BaseModel):
    student_id: Optional[int] = None
    parent_id: Optional[int] = None
    user_type: str
    message: str


class AIChatResponse(BaseModel):
    reply: str
    provider: str = "fallback"


class UploadResponse(BaseModel):
    url: str
    filename: str
    content_type: Optional[str] = None
