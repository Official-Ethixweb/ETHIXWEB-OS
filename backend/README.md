# TeamFlow API

Production-ready Express + MongoDB backend for the TeamFlow team task manager.

## Features

- JWT authentication (`Authorization: Bearer <token>`)
- Project-level role-based access control (Admin / Member)
- RESTful endpoints for projects, tasks, and members
- Zod-based input validation
- Consistent response envelope: `{ success, data, message }`
- CORS allowlist via `CLIENT_ORIGIN`
- Rate limiting on `/auth`
- Structured error logging via morgan + a tiny logger

## Quick Start

```bash
cp .env.example .env
# edit .env with your MongoDB URI + JWT secret

npm install
npm run dev      # nodemon
# or
npm start
```

API will be available at `http://localhost:4000`.

## Environment Variables

| Var | Description |
|---|---|
| `PORT` | HTTP port (default `4000`) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Long random string used to sign JWTs |
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`) |
| `CLIENT_ORIGIN` | Comma-separated allowed origins for CORS |
| `NODE_ENV` | `development` or `production` |

## Deploy to Railway

1. Push this folder to a GitHub repo.
2. Create a new Railway project from the repo.
3. Add a **MongoDB** plugin (or use MongoDB Atlas) and copy its `MONGODB_URI`.
4. Set the env vars above. `CLIENT_ORIGIN` should be your deployed frontend URL.
5. Railway uses `railway.json` → `npm start` → health check on `/health`.

## RBAC Summary

| Action | Member | Admin |
|---|:---:|:---:|
| View project & tasks | ✅ | ✅ |
| Create task | ✅ | ✅ |
| Update task **status** (drag-and-drop) | ✅ | ✅ |
| Update task title / description / priority / due date | ❌ | ✅ |
| Assign task | ❌ | ✅ |
| Delete task | ❌ | ✅ |
| Add / remove members | ❌ | ✅ |
| Change member role | ❌ | ✅ |
| Delete project | ❌ | ✅ |

## API

All responses are wrapped:

```json
{ "success": true, "data": { ... }, "message": "OK" }
```

Errors:

```json
{ "success": false, "error": "Validation failed", "message": "Validation failed", "details": [...] }
```

### Auth

| Method | Path | Body |
|---|---|---|
| `POST` | `/auth/signup` | `{ name, email, password }` |
| `POST` | `/auth/login` | `{ email, password }` |
| `GET`  | `/auth/me` | none |
| `POST` | `/auth/logout` | none |

### Projects

| Method | Path | Role |
|---|---|---|
| `GET`    | `/projects` | any auth user |
| `GET`    | `/projects/:projectId` | member |
| `POST`   | `/projects` | any auth user |
| `DELETE` | `/projects/:projectId` | **admin** |
| `POST`   | `/projects/:projectId/members` | **admin** |
| `PATCH`  | `/projects/:projectId/members/:userId` | **admin** |
| `DELETE` | `/projects/:projectId/members/:userId` | **admin** |

### Tasks

| Method | Path | Role |
|---|---|---|
| `GET`    | `/tasks?project=:id` | member |
| `POST`   | `/tasks` | member (no `assignee`) / admin (any field) |
| `PATCH`  | `/tasks/:id` | member (`status`, `order` only) / admin (any field) |
| `DELETE` | `/tasks/:id` | **admin** |

### Users

| Method | Path |
|---|---|
| `GET` | `/users/search?q=` |

### Health

`GET /health` → `{ success: true, data: { status, uptime, db } }`
