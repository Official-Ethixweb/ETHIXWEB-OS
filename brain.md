# ETHIXWEB OS: Brain Doc

Full-stack company operating system for ETHIXWEB (formerly "TeamFlow", a generic task manager): React/Vite SPA + Express/MongoDB API, JWT auth, project-level RBAC + company-wide RBAC, Kanban board, Employee/HRMS directory. Premium red/black glass brand identity throughout.

**This is Phase 1 of a much larger planned build.** The full target scope (payroll, subscriptions, domains, servers, licenses, finance, full reminder engine, document center, granular settings, etc.) is intentionally deferred: see "Roadmap / Deferred" below. Do not assume unbuilt modules exist just because they're referenced in older planning docs.

## Live Deployment (Railway, two services)

Deployment URLs/branding below (Railway env vars, README) still say "teamflow": they were not renamed as part of the Phase 1 rebrand (only the app UI/branding was). Update these if/when the Railway services themselves get renamed.

| Service | URL |
|---|---|
| Frontend | https://teamflow-dashboard-production-d225.up.railway.app |
| Backend | https://teamflow-dashboard-production.up.railway.app |
| Backend health | `/health` on backend URL |

Demo login: `akashlakhwan2329@gmail.com` / `AKASH@2329l`

## Repo Layout

```
teamflow-dashboard/
  backend/                  Express + MongoDB API (CommonJS)
    src/
      config/db.js          mongoose.connect wrapper
      middleware/
        auth.js             requireAuth (JWT verify), requireProjectRole(opts)
        validate.js         zod schema -> 400 middleware
        error.js             notFound + errorHandler (final handlers)
      models/
        User.js             name, email(unique), passwordHash, avatarColor, companyRole(superadmin|owner|hr|finance|manager|developer|designer|qa|employee|viewer, default employee); bcrypt compare/hash statics; toJSON strips passwordHash
        Project.js           name, description, color, owner(ref User), members[{user, role}]; pre-save dedupes members
        Task.js              project(ref), title, description, assignee(ref User|null), status(todo|in_progress|done), priority(low|med|high), dueDate, order, createdBy
        Employee.js           employeeId(EW-0001..), user(ref User, optional), name/email/phone/photoUrl, department(enum), designation, employmentType, companyRole mirror, joiningDate, dateOfBirth, status(active|on_leave|resigned|terminated), salary{amount,currency}+salaryHistory[], bankDetails, documents[], emergencyContact, skills[], assignedAssets[], notes, experienceYears, seedTag
        Attendance.js          employee(ref), date, status(present|absent|leave|holiday); unique per (employee,date)
        LeaveRequest.js         employee(ref), type, startDate, endDate, reason, status(pending|approved|rejected), reviewedBy
      routes/
        auth.js              POST /auth/signup (first user in empty DB becomes companyRole 'owner'), /auth/login, GET /auth/me, POST /auth/logout
        projects.js           GET /projects, GET/:id, POST /, DELETE/:id (admin), POST/:id/members (admin), PATCH/:id/members/:userId (admin), DELETE/:id/members/:userId (admin)
        tasks.js               GET /tasks?project=, POST /, PATCH /:id, DELETE /:id (admin): members restricted to status+order patch only
        users.js                GET /users/search?q=, GET /users (returns only "me": no full user listing, privacy)
        employees.js             GET / (directory, any authenticated user, read-only), GET/:id, POST / (HR roles only), PATCH/:id, DELETE/:id, POST/:id/photo, POST/:id/documents (multer upload)
        attendance.js            GET /, POST / (self or HR/manager, upserts per day)
        leaves.js                GET /, POST / (self or HR/manager), PATCH/:id (approve/reject, HR/manager only)
      middleware/
        (existing) requireAuth, requireProjectRole(opts): unchanged, still governs Kanban
        requireCompanyRole(roles[])  new: independent RBAC gate for company-wide modules (Employees now, Payroll/Finance later); reads req.user.companyRole
        upload.js                new: multer disk storage under backend/uploads/{photos,documents}/, image/pdf filters, publicUrlFor() helper; served at /uploads/*
      scripts/
        seed.js                 `npm run seed`: idempotent (seedTag 'phase1-demo'), creates 9 demo employees across departments + current-week attendance + 2 leave requests, with birthdays/anniversaries computed relative to "today" so dashboard widgets always have upcoming events
      utils/
        logger.js, respond.js (ok() envelope + ApiError class)
      server.js              app wiring, CORS (same-host + *.up.railway.app in prod + CLIENT_ORIGIN allowlist), rate limit on /auth, serves /uploads statically, serves frontend dist in production
  src/                       Frontend (Vite + React 18 + TS)
    api/                     axios wrappers: auth.ts, projects.ts, tasks.ts, users.ts, employees.ts, attendance.ts, leaves.ts, normalize.ts (snake/camel + id mapping incl. normEmployee/normAttendance/normLeave)
    components/              ErrorBoundary, RequireAuth, NavLink, UserAvatar, Logo (rebuilt on real ETHIXWEB emblem asset), LogoReveal (animated splash), NoiseOverlay, CommandPalette (Ctrl/Cmd+K), ui/ (shadcn)
    context/AuthContext.tsx  token via localStorage OR sessionStorage depending on "Remember me" (see lib/api.ts setToken(token, remember)), auto `/auth/me` on load, global 401 -> logout+redirect
    hooks/                   useAllTasks, useDerivedNotifications (overdue/assigned), useEmployees, useEmployeeNotifications (upcoming birthdays/anniversaries within 14 days), useCountUp (animated stat counters), useDebounce, use-mobile
    layouts/AppLayout.tsx    shell for authenticated app (`/app/*`): collapsible glass sidebar (persisted in localStorage `ew_sidebar_collapsed`), nav is data-driven array (Dashboard/Projects/Employees), topbar has Cmd+K trigger + notification popover merging task + employee-event notifications
    lib/api.ts               axios instance, unwraps `{success,data,message}` envelope, apiErrorMessage/toastApiError helpers, setToken(token, remember) for Remember-Me
    pages/                   Landing, AuthForm(login|signup, with Remember Me), Dashboard (task charts + Employee widgets: headcount/on-leave/upcoming events), Projects, ProjectDetail (Kanban), Employees (directory grid, HR-gated create), EmployeeDetail (tabbed: Overview/Documents/Attendance/Leave/Salary History/Assets), NotFound
    types.ts                 Role, Priority, Status, CompanyRole, HR_COMPANY_ROLES, User(+companyRole), Member, Project, Task, Notification(+birthday/anniversary types), Employee, AttendanceRecord, LeaveRequest, Department, EmploymentType, EmployeeStatus
  public/brand/              emblem-180.png, emblem-transparent.png, wordmark-red.svg: real ETHIXWEB assets (source: "ASSETS THAT YOU CAN CHECK OUT/" one level above teamflow-dashboard)
```

## Auth & RBAC Model

Two **independent** RBAC systems live side by side: do not conflate them:

1. **Per-project RBAC** (unchanged from original TeamFlow): `admin` | `member` on `Project.members`. Project owner always treated as `admin`. `requireProjectRole({role:'admin'})` guards project routes; tasks.js reimplements the same check inline (`loadProjectAndRole`) because projectId can come from body/task record instead of URL param. Members can view, create tasks, and change task `status`/`order` only.
2. **Company-wide RBAC** (new, Phase 1): `companyRole` field on `User`/`Employee`: `superadmin|owner|hr|finance|manager|developer|designer|qa|employee|viewer`. Governs Employees module now, will govern Payroll/Finance later. `requireCompanyRole(roles[])` in `backend/src/middleware/auth.js`. First user ever created (empty `User` collection) is auto-promoted to `owner` at signup; everyone after defaults to `employee`. HR-gated actions (create/edit/delete employee, upload docs, approve leave) require `['superadmin','owner','hr']` (or `+'manager'` for leave/attendance approval): see `HR_COMPANY_ROLES` in `src/types.ts` for the frontend mirror used to gate UI (e.g. "Add employee" button visibility).

Employee directory itself (`GET /employees`) is read-only for **any** authenticated user: it's a company directory, not HR-only data.

## API Response Envelope

Every response: `{ success: boolean, data: {...}, message: string }`. Frontend axios interceptor (`src/lib/api.ts`) auto-unwraps `data` so callers just get the payload directly.

## Brand System

Palette lives entirely in CSS custom properties (`src/index.css` `:root`), so recoloring the whole app is a token edit, not a per-component hunt: Tailwind classes reference `hsl(var(--primary))` etc. throughout.

- `--primary: 358 70% 32%` (#8A181C), `--primary-glow: 358 80% 50%` (vivid red for glows/gradients), backgrounds `0 0% 3%/6%/8%` (#080808/#101010/#141414), `--border: 0 0% 14%` (approximates `rgba(255,255,255,0.08)` on near-black), `.glass`/`.glass-strong` utility classes unchanged in structure, just retuned.
- Gradients are intentionally monochrome red (`--gradient-primary` etc.): per brand spec, no multi-hue "childish" gradients.
- `.noise-overlay` utility (fixed, opacity 0.035, SVG feTurbulence data-URI, mix-blend-mode overlay) adds the subtle texture layer; mounted once globally via `<NoiseOverlay />` in `App.tsx`.
- `Logo.tsx` renders the real `public/brand/emblem-transparent.png` in a rounded gradient tile (not an inline-generated mark like the old TeamFlow logo). `LogoReveal.tsx` is the animated Framer Motion splash version (glow ring + scale-in), used on the login page and available for future splash/loading screens.

## Roadmap / Deferred (not built: do not assume these exist)

Payroll & Bonus system, Subscription Manager, Domain Manager, Server Management, License Manager, full Reminder Engine (cron + email + push: only in-app derived notifications exist today), Finance module, cross-module Analytics, Task management upgrades (timeline/calendar/priority matrix/dependencies/comments/time tracking), generalized Document Center (Employee documents exist, nothing else), Settings page (SMTP/branding/backup/audit logs), granular Roles & Permissions UI (roles exist in the data model + route guards, no admin UI to manage them yet), real 2FA/session mgmt/IP logs, global search across all modules (Cmd+K currently covers pages/projects/employees only), company Calendar, AI Assistant/forecasting, light/glass theme toggle (dark-only today), gamification (badges/confetti). See `C:\Users\akash\.claude\plans\resilient-kindling-mitten.md` for the full Phase 1 plan this was built from.

## Local Development (now running)

```
Backend:  http://localhost:4000   (MongoDB: mongodb://localhost:27017/teamflow, local Windows "MongoDB" service)
Frontend: http://localhost:8081   (default 8080 was occupied by an unrelated process on this machine, Vite auto-picked 8081)
```

Setup performed this session:
1. Copied `backend/.env.example` -> `backend/.env`, `.env.example` -> `.env` at root.
2. `npm install` in `backend/` and root.
3. Started backend (`npm run dev`, nodemon): connects to local MongoDB service (already running as Windows service `MongoDB`).
4. Started frontend (`npm run dev`, Vite): bound to 8081 since 8080 was taken.
5. **Important local quirk**: backend `.env` `CLIENT_ORIGIN` had to be updated from `http://localhost:8080` to `http://localhost:8081` to match the actual Vite port, otherwise CORS blocks the frontend. If Vite ever falls back to a different port again, update `backend/.env` `CLIENT_ORIGIN` to match and restart the backend (nodemon does NOT watch `.env` changes: must be manually restarted).

## Railway Deployment Notes (from README)

- Two separate Railway services, frontend root `/`, backend root `/backend`.
- Frontend start: `vite preview --host 0.0.0.0 --port $PORT`; build: `npm run build`.
- Backend start: `npm start`; healthcheck `/health`; needs `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN` set to the deployed frontend URL.
- Deploy order matters: backend first, verify `/health`, then frontend, then wire `VITE_API_URL`/`CLIENT_ORIGIN` both ways and redeploy both.
- Do not set `PORT` manually on Railway (auto-provided). Do not add MongoDB vars to the frontend service.

## Known Rough Edges

- `npm install` on root reports 20 vulnerabilities (1 low/6 moderate/12 high/1 critical): not yet audited/fixed, pre-existing in the dependency tree (shadcn/radix/vite chain), not something introduced this session.
- Root `tsconfig.json` shows a build warning referencing `astro/tsconfigs/base`: appears to originate from a sibling/parent config outside this project folder, not from `teamflow-dashboard` itself; harmless for `vite dev` but worth checking if it starts failing type-checks.
- `JWT_SECRET` in local `.env` is the example placeholder (`change_me_to_a_long_random_string`): fine for local dev only, never reuse in production.
