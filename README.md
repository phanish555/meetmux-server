# PlaceMux API — Core Server

Base Node.js server for the PlaceMux Phase 1 backend track.

## Requirements

- Node.js 18 or higher
- npm 9 or higher

## Setup

```bash
git clone <your-repo-url>
cd placemux-server
npm install
cp .env.example .env
```

## Environment variables

| Variable   | Description                       | Default       |
| ---------- | --------------------------------- | ------------- |
| `PORT`     | Port the server listens on        | 3000          |
| `NODE_ENV` | `development` or `production`     | development   |
| `APP_NAME` | Display name in responses         | PlaceMux API  |

## Running

```bash
npm run dev     # development, auto-restarts on save
npm start       # production
```

Server starts at `http://localhost:3000`.

## Endpoints

| Method | Path                  | Description       | Status codes    |
| ------ | --------------------- | ----------------- | --------------- |
| GET    | `/api/v1/health`      | Liveness check    | 200             |
| GET    | `/api/v1/ready`       | Readiness check   | 200             |
| GET    | `/api/v1/users`       | List all users    | 200             |
| GET    | `/api/v1/users/:id`   | Fetch one user    | 200 / 400 / 404 |

### Example

```bash
curl http://localhost:3000/api/v1/health
```

```json
{
  "status": "ok",
  "app": "PlaceMux API",
  "environment": "development",
  "uptimeSeconds": 12,
  "timestamp": "2026-07-18T09:14:22.001Z"
}
```

## Project structure

```
src/
├── config/       Environment loading and validation
├── routes/       URL to controller mapping
├── controllers/  Request/response handling
├── services/     Business logic
├── middleware/   Cross-cutting concerns (errors, logging)
├── app.js        Express app assembly
└── server.js     Server bootstrap
```

## Notes

- `.env` is gitignored. Copy `.env.example` and fill it in.
- Users are served from an in-memory array; a real database lands in a later task.
- `helmet` and `cors` are enabled by default.
