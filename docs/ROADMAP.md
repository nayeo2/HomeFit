# Implementation Roadmap

| Step | Work | Done when |
|---|---|---|
| 0 | Install VS Code, Node.js LTS, Git, Codex extension | `node -v`, `npm -v`, `git --version` work |
| 1 | Scaffold React+TS Vite, initialize Git | `npm run dev` displays starter app |
| 2 | Install/router/style/form/state/test libraries | Dependencies configured; app builds |
| 3 | Implement layout and design tokens | Shared header, buttons, inputs, progress |
| 4 | Build landing page | Matches agreed HomeFit design |
| 5 | Build five input steps | Validation, conditional fields, in-memory state |
| 6 | Build pure finance calculation functions | Unit tests pass |
| 7 | Add verified, versioned regulation rules | Unverified cases return `NEEDS_VERIFICATION` |
| 8 | Build results dashboard and detail tabs | Explainable values and caveats |
| 9 | Build scenario simulator | Recompute without mutating baseline |
| 10 | Run tests, responsive/privacy checks | No user data persisted or transmitted |
| 11 | Deploy static SPA | Public URL works and privacy check passes |

## Codex task cadence
- One scoped feature per request. Read AGENTS.md plus only the relevant document.
- Request concise change summary and changed-file list.
- For UI, run build/tests after about two requests; for calculation logic, test immediately.
- Commit after stable milestones. Avoid premature backend/API integration.

## First task
Inspect the scaffold, follow AGENTS.md, and configure Tailwind, router, base layout and placeholder pages. Do not implement financial rules yet.
