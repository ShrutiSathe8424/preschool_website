import datetime as dt
import logging
import os
import random
import re
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
    "You are Hoot, a warm, playful owl who is a learning buddy for preschool children aged 3 to 5. "
    "Like a smart helper, you can do many things: tell complete stories and bedtime stories, make up poems, "
    "rhymes and little songs, ask riddles, tell gentle jokes, answer 'why' and 'what is' questions about animals, "
    "nature, space, food, the body and the world, teach letters, words, numbers, colours, shapes and simple maths, "
    "play counting and guessing games, and suggest easy drawing or craft ideas.\n\n"
    "How to answer:\n"
    "- For stories, poems, rhymes and songs, tell the WHOLE thing from the start to a happy ending, about 120 to "
    "250 words. Never stop halfway and never end with 'to be continued'.\n"
    "- For simple questions, answer in 1 to 4 short sentences, and you may ask one tiny question back.\n"
    "- If the child says 'again', 'another one' or 'more', use the earlier chat to continue or give a new one.\n"
    "- Use very easy words and short sentences. Be kind, cheerful and encouraging.\n"
    "- Your words are read aloud by a voice, so write plain spoken sentences only: no emojis, no markdown, "
    "no bullet points, no headings, no stars or symbols.\n"
    "- Reply in the language the child uses (English, Hindi or Marathi).\n"
    "- Make up your own original rhymes and songs. Do not copy lyrics of modern songs.\n\n"
    "Safety: keep everything gentle and suitable for a small child. Never discuss anything frightening, violent, "
    "sexual, or about drugs, weapons or dangerous things to try. If asked about something unsuitable or dangerous, "
    "kindly say you cannot help with that and suggest a happy topic or asking a grown-up. Never ask for or share "
    "personal details such as an address, phone number or school. If the child sounds sad, hurt or scared, be kind "
    "and tell them to talk to a grown-up they trust right away."
)

MAX_HISTORY_TURNS = 10      # how many earlier messages Hoot remembers
MAX_TURN_CHARS = 1500       # per remembered message, to keep requests small
MAX_REPLY_TOKENS = 1500     # enough for a full story, also in Hindi/Marathi (more tokens per word)
PROVIDER_TIMEOUT = 45       # seconds; long stories take longer than short answers


@router.post("/ai-buddy/chat", response_model=schemas.AIChatResponse)
def ai_buddy_chat(payload: schemas.AIChatRequest, db: Session = Depends(get_db)):
    reply, provider = generate_ai_reply(payload.message, payload.history)

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


def _build_turns(message: str, history) -> list[dict]:
    """
    Turn the recent chat into a clean user/assistant sequence.

    Providers want the conversation to start with the user and to alternate, so
    leading assistant turns are dropped and neighbouring same-role turns merged.
    The child's new message is always the last turn.
    """
    turns: list[dict] = []
    for item in list(history or [])[-MAX_HISTORY_TURNS:]:
        role = "assistant" if item.role == "assistant" else "user"
        text = (item.text or "").strip()[:MAX_TURN_CHARS]
        if not text:
            continue
        if not turns and role == "assistant":
            continue
        if turns and turns[-1]["role"] == role:
            turns[-1]["text"] += "\n" + text
        else:
            turns.append({"role": role, "text": text})

    message = (message or "").strip()[:MAX_TURN_CHARS]
    if turns and turns[-1]["role"] == "user":
        turns[-1]["text"] += "\n" + message
    else:
        turns.append({"role": "user", "text": message})
    return turns


def generate_ai_reply(message: str, history=None) -> tuple[str, str]:
    """
    Tries the configured provider, then falls back to built-in replies.

    A provider failure must never break Child Mode, so every error is logged
    server-side and the child still gets a friendly answer.
    """
    openai_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    gemini_key = (os.getenv("GEMINI_API_KEY") or "").strip()
    turns = _build_turns(message, history)

    if openai_key:
        try:
            return _call_openai(turns, openai_key), "openai"
        except Exception as exc:  # noqa: BLE001 - provider errors are non-fatal
            logger.warning("OpenAI call failed, using fallback: %s", exc)
    if gemini_key:
        try:
            return _call_gemini(turns, gemini_key), "gemini"
        except Exception as exc:  # noqa: BLE001
            logger.warning("Gemini call failed, using fallback: %s", exc)

    return _fallback_reply(message), "fallback"


# --------------------------------------------------- built-in (no AI key) replies
# Used only when no AI provider is configured or the provider is down. They are
# complete little pieces (not one-line teasers) so Hoot still feels alive, but
# they are fixed: real "answer anything" behaviour needs an API key.
_STORIES = [
    "Once upon a time, there was a little bunny named Bella. Bella loved carrots more than anything. "
    "One sunny morning she found a giant carrot growing in the garden. She pulled and pulled, but it would not come out. "
    "Along came Bruno the bear. Let me help, said Bruno. They pulled together. One, two, three, pop! "
    "Out came the carrot. Bella and Bruno shared it, crunch, crunch, crunch. "
    "They learned that when friends help each other, everything gets easier. The end.",
    "Hoot the owl loved the night. One evening the moon was hiding behind a fluffy cloud, and the forest was very dark. "
    "The little animals felt worried. Don't worry, said Hoot, I will find the moon. "
    "He flew up, up, up, and gently blew the cloud away. Out came the big, bright, smiling moon! "
    "The animals clapped and cheered. Then they said goodnight and went to sleep, happy and warm. The end.",
    "Dotty the duck loved rainy days. When the rain stopped, she found a big puddle and jumped in with a splash! "
    "Her friend Froggy jumped in too, ribbit, splash! Then came a tiny snail, slow and shy. "
    "Come on in, said Dotty. The snail smiled and slid into the water. Soon everyone was laughing and splashing together. "
    "Then the sun came out and painted a beautiful rainbow over the puddle. Red, yellow, green and blue. What a happy day! The end.",
]

_RHYMES = [
    "Little fish, little fish, swimming in the sea. Wiggle, wiggle, wiggle, come and play with me! "
    "Little fish, little fish, swish your tail so fast. Splash, splash, splash, what a fun time we have had at last!",
    "One little bunny hops, hop, hop, hop. Two little ducks go splish, splash, plop. "
    "Three little bees buzz up so high. Four little stars twinkle in the sky. "
    "Count with me, one, two, three, four. Let's count again, and then some more!",
    "Rain, rain, falling down, on the roof and on the town. Pitter patter, splash, splash, splash, "
    "puddles for jumping, quick, dash, dash! Rain, rain, time to go, here comes the sun with a golden glow.",
]

_RIDDLES = [
    "Here is a riddle. I have a very long trunk and big flappy ears. I love to spray water. Who am I? "
    "Think, think, think. An elephant! Well done if you guessed it!",
    "Here is a riddle. I say meow and I love to drink milk. Who am I? Think, think, think. A cat! Meow!",
    "Here is a riddle. I am yellow and bright, and I shine up in the sky in the day. Who am I? "
    "Think, think, think. The sun! Hello, sunshine!",
]

_JOKES = [
    "Why did the cow go to space? To see the Milky Way! Moo-ha-ha!",
    "What do you call a sleeping bull? A bulldozer! Ha ha!",
    "Why did the duck get a prize? Because he was a quack-up! Quack, quack!",
]

# animal: (sound, one friendly fact)
_ANIMALS = {
    "cow": ("moo", "A cow is a big, gentle animal that gives us milk. It eats grass all day."),
    "dog": ("woof", "A dog is a friendly pet. Dogs wag their tails when they are happy."),
    "cat": ("meow", "A cat is a soft, furry pet. Cats purr when they are happy."),
    "duck": ("quack", "A duck has feathers and a flat beak. Ducks love to swim in ponds."),
    "sheep": ("baa", "A sheep has fluffy wool that is made into warm clothes."),
    "lion": ("roar", "A lion is a big cat with a fluffy mane. Lions live in the grassland."),
    "horse": ("neigh", "A horse is a strong, fast animal. Some horses pull carts and some carry children."),
    "pig": ("oink", "A pig is a pink farm animal that loves to roll in mud."),
    "frog": ("ribbit", "A frog can jump very far and loves to live near water."),
    "elephant": ("pa-room", "An elephant is the biggest animal on land. It uses its long trunk like a hand."),
    "monkey": ("ooh ooh aah aah", "A monkey is a clever animal that loves to climb trees and eat bananas."),
    "bird": ("tweet tweet", "A bird has feathers and wings, and most birds can fly high in the sky."),
    "fish": ("blub blub", "A fish lives in water and uses its tail to swim."),
    "bunny": ("squeak", "A bunny has long ears and soft fur, and it hops. Bunnies love carrots."),
    "rabbit": ("squeak", "A rabbit has long ears and soft fur, and it hops. Rabbits love carrots."),
}

_SHAPES = (
    "A circle is round like a ball. A square has four equal sides like a window. "
    "A triangle has three sides like a slice of pizza. Can you find a circle in the room?"
)


def _has(text: str, *words: str) -> bool:
    """Whole-word match, so 'cat' does not fire inside 'category'."""
    return any(re.search(rf"\b{re.escape(w)}\b", text) for w in words)


def _fallback_reply(message: str) -> str:
    text = (message or "").lower()

    # simple sums: "2 plus 3", "5 - 2", "what is 4 + 1"
    sum_match = re.search(r"\b(\d{1,2})\s*(\+|plus|add|-|minus|take away)\s*(\d{1,2})\b", text)
    if sum_match:
        a, op, b = int(sum_match.group(1)), sum_match.group(2), int(sum_match.group(3))
        if op in ("+", "plus", "add"):
            return f"{a} plus {b} makes {a + b}! Great thinking. Want to try another one?"
        if a >= b:
            return f"{a} take away {b} leaves {a - b}! Great thinking. Want to try another one?"

    if _has(text, "story", "tale", "bedtime"):
        return random.choice(_STORIES)
    if _has(text, "rhyme", "poem", "sing", "song", "poetry"):
        return random.choice(_RHYMES)
    if _has(text, "riddle", "puzzle", "guess"):
        return random.choice(_RIDDLES)
    if _has(text, "joke", "funny", "laugh"):
        return random.choice(_JOKES)
    if _has(text, "abc", "alphabet", "letter", "letters"):
        return (
            "Let's sing the alphabet words! A is for apple. B is for ball. C is for cat. D is for dog. "
            "E is for egg. F is for fish. G is for goat. Great job! Want to learn more letters?"
        )
    for name, (sound, fact) in _ANIMALS.items():
        if _has(text, name, name + "s"):
            if _has(text, "sound", "say", "says", "noise"):
                return f"A {name} says {sound}! Can you say {sound} too?"
            return f"{fact} A {name} says {sound}! Can you say {sound}?"
    if _has(text, "shape", "shapes", "circle", "square", "triangle"):
        return _SHAPES
    if _has(text, "color", "colour", "colors", "colours"):
        return "Red like an apple, blue like the sky, yellow like the sun and green like the grass! Which one is your favourite?"
    if _has(text, "count", "number", "numbers", "maths", "math") or re.search(r"\d", text):
        return "Let's count together! 1, 2, 3, 4, 5. Great counting! Can you count to ten with me?"
    return "Hi friend! I am Hoot. Ask me for a story, a rhyme, a riddle or a joke, or ask me about animals, letters, numbers and colours!"


def _post_json(url: str, *, headers: dict | None = None, json: dict, timeout: int = PROVIDER_TIMEOUT) -> dict:
    """One small HTTP helper so both providers share the same timeout and error shape."""
    import requests  # imported lazily so the app still starts without the extra

    response = requests.post(url, headers=headers or {}, json=json, timeout=timeout)
    if response.status_code >= 400:
        raise RuntimeError(f"HTTP {response.status_code}: {response.text[:200]}")
    return response.json()


def _call_openai(turns: list[dict], api_key: str) -> str:
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages += [{"role": t["role"], "content": t["text"]} for t in turns]
    data = _post_json(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": messages,
            "max_completion_tokens": MAX_REPLY_TOKENS,
        },
    )
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError(f"Unexpected OpenAI response: {str(data)[:200]}")
    text = (choices[0]["message"]["content"] or "").strip()
    if not text:
        raise RuntimeError("OpenAI returned an empty reply")
    return text


def _call_gemini(turns: list[dict], api_key: str) -> str:
    model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    contents = [
        {"role": "model" if t["role"] == "assistant" else "user", "parts": [{"text": t["text"]}]}
        for t in turns
    ]
    data = _post_json(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        json={
            "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
            "contents": contents,
            "generationConfig": {"maxOutputTokens": MAX_REPLY_TOKENS, "temperature": 0.8},
        },
    )
    candidates = data.get("candidates") or []
    if not candidates:
        raise RuntimeError(f"Unexpected Gemini response: {str(data)[:200]}")
    parts = (candidates[0].get("content") or {}).get("parts") or []
    text = "".join(p.get("text", "") for p in parts).strip()
    if not text:
        raise RuntimeError(f"Gemini returned no text (finishReason={candidates[0].get('finishReason')})")
    return text


@router.get("/ai-buddy/status")
def ai_status():
    """Lets staff confirm from the UI whether a real AI key is actually wired up."""
    if os.getenv("OPENAI_API_KEY"):
        return {"provider": "openai", "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"), "configured": True}
    if os.getenv("GEMINI_API_KEY"):
        return {"provider": "gemini", "model": os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite"), "configured": True}
    return {"provider": "fallback", "model": None, "configured": False}
