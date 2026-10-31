# HomeFit Codex Rules

## Scope
- Build a Korean, privacy-first home-purchase feasibility SPA.
- Stack: React, TypeScript, Vite, Tailwind CSS, React Router, React Hook Form, Zod, Zustand, Recharts, Vitest.
- No backend, database, authentication, or user-financial-data transmission.
- Keep financial inputs/results in memory only. Never store them in localStorage, sessionStorage, cookies, URLs, telemetry, or logs.

## Working rules
- Read only this file and the docs relevant to the current task. Do not repeatedly read all docs.
- Inspect relevant source files before editing. Make small, scoped changes; do not refactor unrelated code.
- Separate UI, input validation, calculation functions, and regulation rules.
- Do not invent Korean lending limits, eligibility thresholds, approval probabilities, or current regulations. Use verified, dated official sources; otherwise return `NEEDS_VERIFICATION`.
- Distinguish indicative calculations from actual lender decisions. Never claim loan approval.
- Add/update unit tests when calculation logic changes. Run build/test after roughly two UI requests, but test financial logic immediately.
- Never add a dependency without explaining why.
- Report briefly in Korean: changed files, what works, tests run, next step.

## Task routing
- Product scope and acceptance: docs/REQUIREMENTS.md
- Screens and navigation: docs/SCREENS.md
- Financial calculations and regulations: docs/FINANCE_RULES.md
- Implementation order: docs/ROADMAP.md
- Project overview and commands: README.md
