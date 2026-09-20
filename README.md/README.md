# Sprout — Preschool Learning & Management Suite

A full-stack app for a preschool: four modules, one codebase.

| Module | Who it's for | What it does |
| --- | --- | --- |
| **Admin** | School office | Classes, staff, families, enrolment, attendance, fees, events, Child Mode content |
| **Teacher** | Class teachers | Daily register, homework with files, activity photos, own attendance |
| **Parent** | Families | Attendance analysis, homework, activities, fee payment by QR, events |
| **Child Mode** | Children 3–5 | A PIN-locked Learning World with videos, games and an AI buddy |

**Stack:** FastAPI + SQLAlchemy + MySQL · React 19 + Vite + React Router · JWT auth.

---

## Quick start

```bash
# 1. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # fill in your MySQL password + SECRET_KEY
python seed_admin.py --demo     # tables, first admin, and a demo class
uvicorn app.main:app --reload

# 2. Frontend (second terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and sign in as `admin@school.com` / `admin123`.
With `--demo` you also get `teacher@school.com` / `teacher123` and
`parent@school.com` / `parent123`. Change these before going anywhere near real data.

Full instructions: [`backend/SETUP.md`](backend/SETUP.md) · [`frontend/SETUP.md`](frontend/SETUP.md)

> **Already running an older version?** New tables are created automatically but
> new columns are not. Run `mysql -u root -p preschool_db < backend/migrate.sql`
> once, then `python seed_admin.py` to back-fill roll numbers and staff IDs.

---

## How each module works

### Admin
The overview counts students, staff, today's attendance, outstanding fees and
upcoming events — every tile opens the module it counts. Everything is editable
after it's created: classes can be renamed, re-assigned or deleted; teachers get
a unique staff ID (`TCH-001`, auto-issued if you leave it blank); parents record
both guardians' names and mobiles; students get a roll number derived from their
class (`NUR-A-007`), re-issued if they move class. Registers for both children
and staff can be corrected on any date. Fees and events are full create / edit /
delete, and events carry a photo.

School settings hold the UPI ID and the payment QR code parents scan.

### Teacher
The register saves in one request and reopens for any past date — change a mark
and save again. Homework and activities each take an attachment: a worksheet PDF,
a photo of the whiteboard, anything up to 80 MB. Teachers also see their own
attendance as marked by the office.

### Parent
Attendance arrives as analysis rather than a log: an attended percentage, a
current streak, six months of stacked bars and the last fortnight. Homework and
activities show the teacher's attachments inline. Fees open a pay screen with the
school's QR code and UPI ID; after paying, the parent enters the UPI reference so
the office can match it against the bank statement.

### Child Mode
Launched from the parent dashboard, and only once a 4-digit PIN is set — that PIN
is what gets the child back out. The entry screen is a cartoon playground with
Bruno, Bella and Hoot. Inside are colours, counting and letter games, any videos
staff uploaded for that child's class, and Hoot, the AI buddy. Sessions are timed,
tab-switching is logged as a focus break, and staying focused earns a star.

Staff curate the video tiles from **Learning World** — admins for any class,
teachers for their own.

---

## The AI Learning Buddy

The original build called the OpenAI API with `requests`, which was never listed
in `requirements.txt`, so every call raised `ModuleNotFoundError` and the error
was never caught. That's fixed three ways:

1. `requests` is now a declared dependency.
2. Provider failures are logged server-side and fall back to built-in preschool
   answers, so a child never sees an error.
3. `GET /api/child/ai-buddy/status` reports which provider is actually live.

Set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`) or `GEMINI_API_KEY` in
`backend/.env`. With no key at all, the buddy still answers — just from the
built-in replies.

---

## Design

Each role owns one crayon colour — admin grape, teacher tangerine, parent teal,
Child Mode bubblegum — over a soft sky wash, with Fredoka for headings and Nunito
for text. The colour is what tells you which module you're in; everything else
stays quiet. Child Mode ignores all of it and uses its own bigger, rounder,
bouncier rules, because a 4-year-old's screen has different needs.

To re-colour the whole app, edit the crayon variables at the top of
`frontend/src/styles/theme.css`.

---

## Project layout

```
backend/
  app/
    main.py             app setup, CORS, /uploads static mount
    models.py           SQLAlchemy tables
    schemas.py          Pydantic request/response models
    auth.py             JWT + bcrypt + role guards
    routers/            auth, admin, teacher, parent, child, content, upload
  migrate.sql           upgrade an existing database
  seed_admin.py         first admin, settings, demo data, ID back-fill
  uploads/              user-uploaded files (add to your backups)

frontend/
  src/
    styles/theme.css    design tokens
    components/ui/      button, card, table, modal, file upload, ...
    components/         AppShell, ProfilePanel, ContentManager, ChildModeGuard
    pages/              Login + one folder per role + ChildDashboard
```

## Security notes

- CORS is restricted to `CORS_ORIGINS` (no wildcard with credentials).
- Every teacher and parent endpoint checks ownership — a teacher can only touch
  their own class, a parent only their own children.
- Uploads are extension-allowlisted, renamed, and size-capped.
- Child Mode has no login of its own by design, and no access to other children's
  records; it's opened from an authenticated parent session and keyed to one child.
- Set a long random `SECRET_KEY` and serve over HTTPS in production.
