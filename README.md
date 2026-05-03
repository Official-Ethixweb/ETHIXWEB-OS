# TeamFlow — Team Task Manager

A premium, full-stack team collaboration platform for organizing projects, assigning tasks, and tracking progress on a Kanban board with role-based access control.

> Built as a portfolio-grade SaaS demo: handcrafted UI, real backend, real database, real auth.

## ✨ Features

- 🔐 **JWT authentication** — sign up, sign in, persistent sessions
- 📁 **Projects with members** — invite teammates by email, control access
- 👥 **Per-project RBAC** — Admin (full control) vs. Member (status-only updates)
- 🧱 **Kanban board** — drag-and-drop with optimistic updates and instant feedback
- 📊 **Live dashboard** — completion charts, task breakdown, recent activity
- 🔔 **Smart notifications** — derived from overdue and assigned tasks
- 🎨 **Premium UI** — glassmorphism, gradients, Framer Motion micro-interactions
- ⚡ **Performance** — debounced search, request caching via React Query, optimistic mutations with rollback

## 🧰 Tech Stack

**Frontend**
- React 18 + Vite + TypeScript
- Tailwind CSS (semantic design tokens) + shadcn/ui
- React Query for data fetching & caching
- @dnd-kit for the Kanban board
- Framer Motion for animations
- Recharts for analytics
- Axios with JWT interceptors and unified error handling

**Backend** (`teamflow-backend.zip`)
- Node.js + Express
- MongoDB + Mongoose
- JWT (`jsonwebtoken`) + bcrypt
- Zod input validation
- CORS allowlist + rate limiting
- Structured error logging (morgan + custom logger)
- Consistent response envelope: `{ success, data, message }`

## 🏗️ Architecture

```
┌──────────────┐    Bearer JWT     ┌─────────────────┐
│  React SPA   │ ────────────────▶ │  Express API     │
│  (Vite)      │ ◀──────────────── │  /auth /projects │
│              │  { success,data } │  /tasks /users   │
└──────────────┘                    └────────┬────────┘
                                             │
                                             ▼
                                       ┌──────────┐
                                       │ MongoDB  │
                                       └──────────┘
```

- All API responses are wrapped in `{ success, data, message }`. The Axios interceptor unwraps `data` automatically.
- A single `RequireAuth` route guard protects `/app/*`.
- 401 responses globally clear the token and redirect to `/login`.
- Project-level role is loaded once per project and gates the UI; the backend re-validates on every mutation.

## 🚀 Getting Started

### 1. Frontend

```bash
# inside this repo
cp .env.example .env.local      # set VITE_API_URL
bun install                      # or npm install
bun dev                          # http://localhost:8080
```

### 2. Backend

Download [`teamflow-backend.zip`](./public/teamflow-backend.zip) (also exposed at `/teamflow-backend.zip` on the deployed frontend) and unzip it.

```bash
cd teamflow-backend
cp .env.example .env             # set MONGODB_URI, JWT_SECRET, CLIENT_ORIGIN
npm install
npm run dev                      # http://localhost:4000
```

The backend `README.md` documents every endpoint and the full RBAC matrix.

## ☁️ Deploy

### Backend → Railway

1. Push the `teamflow-backend` folder to a GitHub repo.
2. New Railway project → deploy from repo.
3. Add a MongoDB plugin (or use MongoDB Atlas) — copy the connection string into `MONGODB_URI`.
4. Set `JWT_SECRET` to a long random string.
5. Set `CLIENT_ORIGIN` to your deployed frontend URL (comma-separated for multiple).
6. Railway picks up `railway.json` and runs `npm start`. Health check: `/health`.

### Frontend → Lovable / Vercel / Netlify

1. Set the env var `VITE_API_URL` to your Railway URL (e.g. `https://teamflow-api.up.railway.app`).
2. Build & deploy. Lovable users: just hit **Publish**.

## 🔒 RBAC Matrix

| Action | Member | Admin |
|---|:---:|:---:|
| View project & tasks | ✅ | ✅ |
| Create task | ✅ | ✅ |
| Update task **status** (drag-and-drop) | ✅ | ✅ |
| Edit task title / description / priority / due date | ❌ | ✅ |
| Assign task | ❌ | ✅ |
| Delete task | ❌ | ✅ |
| Invite / remove members | ❌ | ✅ |
| Change member role | ❌ | ✅ |
| Delete project | ❌ | ✅ |

Enforced on the **backend** for every mutation; mirrored on the frontend for affordance.

## 🌐 Live Demo

> _Replace with your published URL_
>
> **Frontend:** https://your-teamflow.lovable.app
> **API:** https://teamflow-api.up.railway.app

## 📸 Screenshots

> _Add screenshots here once deployed_
>
> - Landing page
> - Dashboard with charts
> - Kanban board with drag-and-drop
> - Invite & role management dialog

## 📁 Project Structure

```
src/
  api/            # Axios + per-resource API modules + normalizers
  components/     # Logo, UserAvatar, RequireAuth, shadcn/ui
  context/        # AuthContext (JWT + me + 401 handling)
  hooks/          # useDebounce, useAllTasks, useDerivedNotifications
  layouts/        # AppLayout (sidebar + topbar + outlet)
  lib/            # api.ts (Axios instance + envelope unwrap)
  pages/          # Landing, AuthForm, Dashboard, Projects, ProjectDetail
public/
  teamflow-backend.zip   # Downloadable Express + Mongo backend
```

## 📄 License

MIT
