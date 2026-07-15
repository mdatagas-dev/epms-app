# EPMS

Engineering Process Management System for controlled Time Studies, Standard Time approval, Line Balance, capacity scenarios, and theoretical manpower calculations.

## MVP workflow

```text
Raw cycle observations
  → submitted Time Study
  → approved Standard Time revision
  → Line Balance / Yamazumi
  → versioned capacity scenario
  → approved Engineering conclusion
```

Production actuals, OEE, Pareto, incident management, and reusable Excel import are intentionally outside this release.

## Local setup

Requirements: Node.js 20.9+ and Docker.

```bash
cp .env.example .env.local
docker compose up -d postgres
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Set strong, distinct seed passwords in `.env.local`; public signup is disabled.

## Verification

```bash
npm test
npm run lint
npm run build
```

## Internal-server deployment

1. Provision PostgreSQL and set `DATABASE_URL`.
2. Set a random `BETTER_AUTH_SECRET` of at least 32 characters and the internal HTTPS URL in `BETTER_AUTH_URL`.
3. Run `npm ci`, `npm run db:migrate`, `npm run build`, and `npm start`.
4. Place the app behind the company reverse proxy with HTTPS.
5. Back up PostgreSQL daily and test restore procedures periodically.

Do not run `npm run db:seed` in production with example passwords. Account provisioning remains an internal Engineering administration task for this MVP.

## Formula contract

- `Normal Time = valid average × performance rating`
- `Standard Time = Normal Time ÷ (1 − allowance)`
- `Takt Time = available production seconds ÷ target quantity`
- `Theoretical Capacity = floor(available time ÷ bottleneck CT)`
- `Theoretical Manpower = ceil(total manual work content ÷ Takt Time)`
- `Line Efficiency = total assigned work content ÷ (active stations × bottleneck CT)`
