# Setup — frontend

## 1. Install
```bash
cd frontend
npm install
```

## 2. Point it at the API
Create `frontend/.env`:
```
VITE_API_BASE_URL=http://localhost:8000
```
Skip this and it defaults to `http://localhost:8000`.

## 3. Run it
```bash
npm run dev
```
Open http://localhost:5173.

Whatever URL you use must also appear in the backend's `CORS_ORIGINS`, or the
browser will block every request.

## Build for production
```bash
npm run build     # output in dist/
npm run preview   # serve the build locally
```

## Where things live
```
src/
  styles/theme.css        design tokens — colours, type, spacing
  components/ui/          buttons, cards, tables, modal, file upload
  components/AppShell.jsx sidebar + page header shared by the three dashboards
  pages/admin/            one file per admin section
  pages/teacher/          attendance, homework, activities
  pages/parent/           attendance analysis, updates, fees
  pages/ChildDashboard.jsx + child-mode.css   Child Mode
```

Each role has its own accent colour, set by `role-admin` / `role-teacher` /
`role-parent` on the shell. To restyle a module, change the crayon variables at
the top of `theme.css` — nothing else needs touching.
