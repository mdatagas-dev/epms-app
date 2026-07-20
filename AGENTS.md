# Repository Guidelines

## Project Overview

EPMS is an internal Engineering Process Management System. Its MVP turns raw time-study evidence into approved, immutable Standard Time revisions, then line-balance/Yamazumi views and versioned capacity scenarios. Production actuals, OEE/Pareto, incidents, Excel import, and reporting are explicitly out of scope.

## Architecture & Data Flow

- **Framework:** Next.js 16 App Router, React 19, strict TypeScript, Tailwind v4, PostgreSQL, and Better Auth.
- **Route flow:** `app/page.tsx` redirects to `/dashboard`. Public login is `app/login/page.tsx`; `app/(app)/layout.tsx` gates application routes with `requireUser()` and owns shared navigation.
- **Read path:** Async Server Components call server-only query functions in `lib/data.ts`. Those functions authenticate and query PostgreSQL through `lib/db.ts` / `lib/pool.ts`.
- **Write path:** Client form components submit to server actions in `app/actions.ts`. Actions authorize roles, validate input, call pure domain calculations, issue parameterized SQL (often inside transactions), record activity, then `revalidatePath()` and redirect.
- **Domain workflow:** Time-study cycles → submitted/approved Standard Time revision → line balance/Yamazumi → capacity scenario. Approval actions enforce workflow state and prevent supervisor self-approval.
- **Business logic:** Keep calculations pure and typed in `lib/engineering.ts`; reuse them in actions, previews, and Node tests. `lib/master-data.ts` owns master-data parsing and validation.
- **Persistence convention:** TypeScript uses `camelCase`; PostgreSQL uses `snake_case`. Use parameterized SQL only. The database schema and invariants are in `db/001_engineering.sql`.

## Key Directories

- `app/` — App Router pages, layouts, auth route handler, and `app/actions.ts` mutations.
- `app/(app)/` — authenticated dashboard, time studies, motion studies, line balance, scenarios, and master data.
- `components/` — client-side forms and visualization/navigation components; interactive files use `'use client'`.
- `lib/` — server-only data/auth/database helpers and pure engineering calculations.
- `db/` — idempotent PostgreSQL schema migration (`001_engineering.sql`).
- `scripts/` — auth/schema migration and idempotent demo-data seeding.
- `tests/` — Node built-in test-runner tests for pure business logic.
- `docs/plans/` — MVP and Yamazumi design constraints; consult before expanding engineering workflows.

## Development Commands

```bash
# First-time local setup
cp .env.example .env.local
docker compose up -d postgres
npm install
npm run db:migrate
npm run db:seed

# Development and verification
npm run dev
npm test
npm run lint
npm run build

# Database lifecycle
npm run db:migrate
npm run db:seed

# Full container stack
docker compose up -d --build
```

Use `npm`; `package-lock.json` is authoritative. Do not run the seed command against production. PostgreSQL is exposed locally at `127.0.0.1:5437` by Compose.

## Code Conventions & Common Patterns

- Use the `@/*` import alias for app code. Server-run scripts may import explicit `.ts` modules, as existing scripts do.
- Use named exports, `PascalCase` React component files/exports, and `camelCase` functions/variables.
- Treat route `params` as promises in App Router pages: `const { id } = await params`.
- Keep pages server-rendered by default. Move only browser interaction/state into a focused `'use client'` component.
- Auth boundaries are mandatory: use `requireUser()` for authenticated reads and `requireAuth(role)` for privileged actions. Server-only modules protect auth, sessions, data access, and the pool.
- Validate untrusted `FormData`/JSON in actions and domain helpers. Throw clear domain errors for invalid workflow/calculation input; map expected user-facing failures to `{ error }` only where the existing form contract does so.
- Use `BEGIN`/`COMMIT`/`ROLLBACK` with client release for multi-step mutations. Revalidate all affected route paths after writes.
- Preserve engineering invariants: Standard Time requires 30–100 valid cycles; approved standards and scenarios are immutable snapshots; Yamazumi statuses are overload `>100%`, balanced `85–100%`, underload `<85%`.
- Do not invent takt values, process-move recommendations, or scope beyond the documented MVP.
- Follow `BRAND.md` for UI tokens, reduced motion, responsive behavior, semantics, and accessibility.

## Important Files

- `app/actions.ts` — mutation and approval workflow entry point.
- `lib/data.ts` — read-side data-access layer for Server Components.
- `lib/engineering.ts` — calculation contracts for standard time, line scenarios, motion studies, and Yamazumi.
- `lib/session.ts`, `lib/auth-config.ts` — session and Better Auth configuration.
- `lib/pool.ts`, `lib/db.ts` — PostgreSQL pool and query helpers.
- `db/001_engineering.sql` — schema, constraints, indexes, and backfills.
- `scripts/migrate.ts`, `scripts/seed.ts` — migration and demo-data workflows.
- `.env.example` — required environment-variable names; never commit `.env.local`.
- `README.md` — setup, operations, deployment, and MVP formula reference.
- `BRAND.md` — UI/interaction conventions.

## Runtime/Tooling Preferences

- Use **npm** with the checked-in lockfile. Local documentation requires Node.js **20.9+**; the production Docker image uses Node 24 Alpine.
- TypeScript is strict, no-emit, ESM, and uses bundler module resolution. Do not weaken compiler settings or bypass type errors.
- ESLint uses the flat configuration in `eslint.config.mjs` with Next Core Web Vitals and TypeScript presets. No formatter is configured; preserve existing formatting.
- Before changing Next.js code, read the relevant current guide under `node_modules/next/dist/docs/`; this repository uses a Next version with breaking API and convention changes.
- Environment values are loaded from `.env.local`; keep secrets and seed credentials out of source control. `BETTER_AUTH_SECRET` must be configured for real deployments.

## Testing & QA

- Run `npm test` for pure TypeScript logic. It uses Node's built-in runner with `--experimental-strip-types`, not Jest/Vitest.
- Add behavior-focused tests to `tests/*.test.ts` using `node:test` and `node:assert/strict`. Follow existing descriptive test names and inline fixtures; test formulas, validation, boundaries, and workflow-derived outputs.
- There is no automated browser, database integration, coverage, or CI harness. For changes touching auth, database workflows, or server actions, manually exercise the relevant PostgreSQL-backed flow after unit/lint/build checks.
- Before completing a permanent behavior change, run the narrowest applicable test plus `npm run lint` and `npm run build` when the changed surface requires them.
