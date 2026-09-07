# Route 53 Clone — Frontend

Next.js 14 App Router console for the Route 53 clone. Uses **AWS Cloudscape Design System** for the main UI.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 (requires backend at http://127.0.0.1:8000).

## Environment

| Variable | Description |
|----------|-------------|
| `API_URL` | Backend URL for Next.js rewrites (server-side). Default: `http://127.0.0.1:8000` |
| `NEXT_PUBLIC_API_URL` | Optional client-side API base (leave empty to use same-origin `/api` proxy) |

## Key routes

- `/login` — Sign in
- `/dashboard` — Live stats overview
- `/hosted-zones` — Zone list with pagination, copy ID, NS delegation
- `/hosted-zones/[id]` — DNS records with routing policy / alias editor
- `/health-checks` — Health check management

## Scripts

- `npm run dev` — Development server
- `npm run build` — Production build
- `npm run lint` — ESLint
