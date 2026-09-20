# Setup — backend

## 1. Requirements
- Python 3.11+
- MySQL 8 (or MariaDB 10.6+)

## 2. Create the database
```sql
CREATE DATABASE preschool_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 3. Install
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## 4. Configure
```bash
cp .env.example .env
```
Fill in your MySQL password and a long random `SECRET_KEY`.

## 5. Create the tables and the first admin
```bash
python seed_admin.py            # admin@school.com / admin123
python seed_admin.py --demo     # also adds a demo class, teacher, parent and child
```

**Upgrading an existing database?** Tables are created automatically, but new
*columns* are not. Run the migration once before starting the app:
```bash
mysql -u root -p preschool_db < migrate.sql
```
Then run `python seed_admin.py` to back-fill roll numbers and staff IDs.

## 6. Run it
```bash
uvicorn app.main:app --reload
```
- API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs

## Uploads
Files land in `backend/uploads/` and are served at `/uploads/<name>`. Change the
location with `UPLOAD_DIR` and the size limit with `MAX_UPLOAD_MB` (default 80).
Add `uploads/` to your backup routine — profile photos, homework files, event
photos, the fee QR and Child Mode videos all live there.

## AI Learning Buddy
Set `OPENAI_API_KEY` (or `GEMINI_API_KEY`) in `.env` and restart. Without a key
the buddy falls back to built-in preschool answers, so Child Mode always works.
Check which provider is live:
```bash
curl http://localhost:8000/api/child/ai-buddy/status
```
If a provider call fails, the error is logged server-side and the child still
gets a friendly reply — it never shows an error.

## Troubleshooting
| Symptom | Fix |
| --- | --- |
| `Access denied for user` | Wrong `DB_USER` / `DB_PASSWORD` in `.env` |
| `Unknown database` | Create `preschool_db` first (step 2) |
| Browser console: CORS error | Add your frontend URL to `CORS_ORIGINS` |
| `Unknown column 'roll_no'` | Run `migrate.sql` (step 5) |
| Uploads return 413 | Raise `MAX_UPLOAD_MB` |
