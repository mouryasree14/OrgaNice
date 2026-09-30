# ORGANICE

AI-assisted campus event planner, built with Next.js, TypeScript, Tailwind CSS and FastAPI. The interface follows the supplied OrgaNice Figma reference: navy workspace sidebar, light cards, blue actions and purple AI surfaces.

## Run locally

1. Copy `.env.example` to `.env` and set a strong `JWT_SECRET` (and optionally `OPENAI_API_KEY`).
2. Start PostgreSQL and the API: `docker compose up --build`.
3. Install frontend packages with `npm install`, then run `npm run dev`.
4. Open `http://localhost:3000` and sign in with `organizer@organice.local` / `password123`.

The API defaults to SQLite (`organice.db`) when `DATABASE_URL` is absent, specifically to keep the demo usable without Docker. Set the documented PostgreSQL URL for production.

## Included working flows

- JWT + bcrypt registration/login, protected API calls and role-bearing tokens.
- Database-seeded TechFest 2.0, Cultural Night and Hackathon 2026.
- AI Planner persists generated event, tasks, schedules, risks and recommendation. The deterministic generator is used without an OpenAI key so the demo never dead-ends.
- Live task completion, CRUD records, budget expense updates, risks, scheduling recommendation application and event progress recomputation.
- AI Copilot answers from dashboard data, and PDF/CSV reports stream from FastAPI.

## API endpoints

`/auth/*`, `/events`, `/dashboard`, `/records/{kind}`, `/ai/plan`, `/copilot`, `/recommendations/{id}/apply`, and `/reports/{pdf|csv}`.
