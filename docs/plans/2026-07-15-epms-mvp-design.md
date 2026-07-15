# EPMS MVP Design

## Goal

Build an Engineering-owned internal system that turns traceable time-study evidence into approved Standard Time revisions, line-balance results, and immutable capacity/manpower scenarios.

## Scope

The MVP includes local Engineer and Engineering Supervisor accounts, minimal master data, 30–100 cycle Time Studies, flagged outliers with reasoned exclusion, Standard Time approval, process-element Line Balance, Yamazumi, Takt Time, theoretical capacity, line efficiency, balance loss, theoretical manpower, and an automatic activity history.

It excludes Production actuals, OEE, Pareto, defects, incident management, operator records, reusable Excel import, and management reports.

## Architecture

Next.js 16 App Router renders authenticated Server Components and uses small Client Components only for interaction-heavy inputs. Server Actions validate inputs and delegate to a server-only PostgreSQL data layer that rechecks authentication and role authorization. Better Auth owns local password authentication and database sessions.

Business formulas live in `lib/engineering.ts` as pure functions. Each approved Standard Time is immutable and effective-dated. Scenarios snapshot the exact approved Standard Time revisions used so later approvals cannot rewrite historical conclusions.

## Calculation contract

- `Normal Time = valid average cycle time × performance rating`
- `Standard Time = normal time ÷ (1 − allowance)`
- `Takt Time = available production seconds ÷ target quantity`
- `Bottleneck CT = maximum active station load`
- `Theoretical Capacity = floor(available production seconds ÷ bottleneck CT)`
- `Theoretical Manpower = ceil(total manual work content ÷ takt time)`
- `Line Efficiency = total assigned work content ÷ (active stations × bottleneck CT)`
- `Balance Loss = 1 − line efficiency`

Available time deducts planned breaks, meetings, setup, and other approved planned stops. Unplanned downtime is outside the MVP.

## Interface direction

The UI is a restrained industrial measurement console: warm off-white surfaces, graphite structure, engineering blue for active evidence, amber for review, and tabular numerals for measurements. High-frequency navigation does not animate. Buttons use short transform-only press feedback, state changes remain under 200 ms, hover effects are pointer-gated, and reduced-motion users receive no spatial movement.

## Acceptance boundary

An Engineer can create a 30-cycle study and submit it. A Supervisor can approve its immutable Standard Time revision. The Engineer can then create a line balance and versioned target scenario that produces Takt Time, Yamazumi bottleneck, theoretical capacity, line efficiency, and theoretical manpower. The dashboard exposes the relevant assumptions, revisions, approvals, and activity records.
