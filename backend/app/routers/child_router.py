import datetime as dt
import logging
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas, auth
from ..database import get_db

logger = logging.getLogger("sprout.ai")
router = APIRouter(prefix="/api/child", tags=["Child Learning"])

# The child module has no email/password login — preschoolers can't type
# credentials. A session is opened by the parent from their own authenticated
# dashboard, and the parent's PIN is required to close it again.


@router.post("/exit-pin/verify", response_model=schemas.VerifyChildPinResponse)
def verify_exit_pin(payload: schemas.VerifyChildPin, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.student_id == payload.student_id).first()
    if not student or not student.parent_id:
        raise HTTPException(status_code=404, detail="Student or linked parent not found")

    parent = db.query(models.Parent).filter(models.Parent.parent_id == student.parent_id).first()
    if not parent or not parent.child_pin_hash:
        raise HTTPException(status_code=400, detail="No Child Mode PIN has been set by the parent yet")

    return schemas.VerifyChildPinResponse(valid=auth.verify_password(payload.pin, parent.child_pin_hash))


# ---------------------------------------------------------------- content
@router.get("/content/{student_id}", response_model=list[schemas.ContentOut])
def learning_content(student_id: int, db: Session = Depends(get_db)):
    """
    Videos and lessons staff uploaded, filtered to this child's class.
    Content with no class set is shown to everyone.
    """
    student = db.query(models.Student).filter(models.Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return (
        db.query(models.LearningContent)
        .filter(
            models.LearningContent.is_active.is_(True),
            (models.LearningContent.class_id == student.class_id) | (models.LearningContent.class_id.is_(None)),
        )
        .order_by(models.LearningContent.created_at.desc())
        .all()
    )


# ---------------------------------------------------------------- sessions
@router.post("/session/start", response_model=schemas.SessionStartResponse)
def start_session(payload: schemas.SessionStart, db: Session = Depends(get_db)):
    session = models.LearningSession(student_id=payload.student_id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return schemas.SessionStartResponse(session_id=session.session_id, start_time=session.start_time)


@router.post("/session/focus-break")
def log_focus_break(payload: schemas.FocusBreakPing, db: Session = Depends(get_db)):
    session = db.query(models.LearningSession).filter(models.LearningSession.session_id == payload.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.focus_breaks = (session.focus_breaks or 0) + 1
    db.commit()
    return {"message": "Focus break logged", "focus_breaks": session.focus_breaks}


@router.post("/session/end", response_model=schemas.SessionEndResponse)
def end_session(payload: schemas.SessionEnd, db: Session = Depends(get_db)):
    session = db.query(models.LearningSession).filter(models.LearningSession.session_id == payload.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.end_time = dt.datetime.utcnow()
    duration = int((session.end_time - session.start_time).total_seconds() // 60)
    session.duration_minutes = duration
    session.focus_breaks = payload.focus_breaks

    reward_earned = None
    if duration >= 20 and payload.focus_breaks <= 1:
        db.add(
            models.Reward(
                student_id=session.student_id,
                reward_type="star",
                reward_name="Focused Learner",
                source="focus_session",
            )
        )
        reward_earned = "star"

    db.commit()
    return schemas.SessionEndResponse(session_id=session.session_id, duration_minutes=duration, reward_earned=reward_earned)


@router.get("/rewards/{student_id}", response_model=list[schemas.RewardOut])
def list_rewards(student_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.Reward)
        .filter(models.Reward.student_id == student_id)
        .order_by(models.Reward.earned_date.desc())
        .all()
    )


@router.get("/progress/{student_id}")
def get_progress(student_id: int, db: Session = Depends(get_db)):
    records = db.query(models.LearningProgress).filter(models.LearningProgress.student_id == student_id).all()
    return [
        {
            "module_name": r.module_name,
            "completed_lessons": r.completed_lessons,
            "quiz_score": r.quiz_score,
            "weak_areas": r.weak_areas,
        }
        for r in records
    ]


@router.post("/progress/{student_id}/update")
def update_progress(student_id: int, payload: schemas.ProgressUpdate, db: Session = Depends(get_db)):
    record = (
        db.query(models.LearningProgress)
        .filter(
            models.LearningProgress.student_id == student_id,
            models.LearningProgress.module_name == payload.module_name,
        )
        .first()
    )
    if not record:
        record = models.LearningProgress(
            student_id=student_id,
            module_name=payload.module_name,
            completed_lessons=payload.completed_lessons,
        )
        db.add(record)
    else:
        record.completed_lessons = payload.completed_lessons
    db.commit()
    return {"message": "Progress updated"}


@router.post("/quiz-result")
def submit_quiz_result(payload: schemas.QuizSubmit, db: Session = Depends(get_db)):
    result = models.QuizResult(student_id=payload.student_id, quiz_name=payload.quiz_name, score=payload.score)
    db.add(result)
    db.commit()
    db.refresh(result)

    reward = None
    if payload.score >= 80:
        db.add(
            models.Reward(
                student_id=payload.student_id,
                reward_type="star",
                reward_name=f"Great score on {payload.quiz_name}",
                source="quiz",
            )
        )
        db.commit()
        reward = "star"

    return {"message": "Quiz recorded", "quiz_id": result.quiz_id, "reward": reward}


# ---------------------------------------------------------------- AI buddy
SYSTEM_PROMPT = (
    "You are a friendly AI Learning Buddy for preschool children aged 3-5. "
    "Keep replies to one or two short sentences, warm and encouraging, using easy words only. "
    "Never discuss anything frightening or unsuitable for a small child."
)


@router.post("/ai-buddy/chat", response_model=schemas.AIChatResponse)
def ai_buddy_chat(payload: schemas.AIChatRequest, db: Session = Depends(get_db)):
    reply, provider = generate_ai_reply(payload.message)

    db.add(
        models.AIConversationLog(
            student_id=payload.student_id,
            parent_id=payload.parent_id,
            user_type=payload.user_type,
            query=payload.message,
            response=reply,
        )
    )
    db.commit()
    return schemas.AIChatResponse(reply=reply, provider=provider)


def generate_ai_reply(message: str) -> tuple[str, str]:
    """
    Tries the configured provider, then falls back to canned replies.

    A provider failure must never break Child Mode, so every error is logged
    server-side and the child still gets a friendly answer.
    """
    openai_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    gemini_key = (os.getenv("GEMINI_API_KEY") or "").strip()

    if openai_key:
        try:
            return _call_openai(message, openai_key), "openai"
        except Exception as exc:  # noqa: BLE001 - provider errors are non-fatal
            logger.warning("OpenAI call failed, using fallback: %s", exc)
    if gemini_key:
        try:
            return _call_gemini(message, gemini_key), "gemini"
        except Exception as exc:  # noqa: BLE001
            logger.warning("Gemini call failed, using fallback: %s", exc)

    return _fallback_reply(message), "fallback"


def _fallback_reply(message: str) -> str:
    text = (message or "").lower()
    if any(word in text for word in ("abc", "alphabet", "letter")):
        return "Let's start! A is for Apple. Can you say A?"
    if "story" in text:
        return "Once upon a time, a little bunny hopped through the garden looking for carrots..."
    if any(word in text for word in ("count", "number", "maths", "math")) or any(str(n) in text for n in range(10)):
        return "Let's count together! 1, 2, 3... can you say what comes next?"
    if any(word in text for word in ("color", "colour")):
        return "Red, blue, yellow and green! Which one is your favourite?"
    if any(word in text for word in ("animal", "dog", "cat")):
        return "A cat says meow and a dog says woof! What sound does a cow make?"
    if any(word in text for word in ("sing", "rhyme", "song")):
        return "Twinkle twinkle little star! Can you sing it with me?"
    return "Hi friend! I'm your Learning Buddy. Ask me about letters, numbers, colours, or say 'tell me a story'!"


def _post_json(url: str, *, headers: dict | None = None, json: dict, timeout: int = 20) -> dict:
    """One small HTTP helper so both providers share the same timeout and error shape."""
    import requests  # imported lazily so the app still starts without the extra

    response = requests.post(url, headers=headers or {}, json=json, timeout=timeout)
    if response.status_code >= 400:
        raise RuntimeError(f"HTTP {response.status_code}: {response.text[:200]}")
    return response.json()


def _call_openai(message: str, api_key: str) -> str:
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    data = _post_json(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": message},
            ],
            "max_tokens": 150,
            "temperature": 0.7,
        },
    )
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError(f"Unexpected OpenAI response: {str(data)[:200]}")
    return (choices[0]["message"]["content"] or "").strip()


def _call_gemini(message: str, api_key: str) -> str:
    model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    data = _post_json(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
        headers={"Content-Type": "application/json"},
        json={
            "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
            "contents": [{"role": "user", "parts": [{"text": message}]}],
            "generationConfig": {"maxOutputTokens": 150, "temperature": 0.7},
        },
    )
    candidates = data.get("candidates") or []
    if not candidates:
        raise RuntimeError(f"Unexpected Gemini response: {str(data)[:200]}")
    return (candidates[0]["content"]["parts"][0]["text"] or "").strip()


@router.get("/ai-buddy/status")
def ai_status():
    """Lets staff confirm from the UI whether a real AI key is actually wired up."""
    if os.getenv("OPENAI_API_KEY"):
        return {"provider": "openai", "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"), "configured": True}
    if os.getenv("GEMINI_API_KEY"):
        return {"provider": "gemini", "model": os.getenv("GEMINI_MODEL", "gemini-1.5-flash"), "configured": True}
    return {"provider": "fallback", "model": None, "configured": False}
