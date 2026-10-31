# Screens and UX

Design: clean Korean fintech UI; white, navy text, blue primary CTA, gray cards, green success, amber warning; Pretendard, responsive.

| Page | Route | Content | Primary action |
|---|---|---|---|
| Landing | `/` | Hero, value propositions, privacy notice | Start diagnosis |
| Basic | `/diagnosis/basic` | Age, marital/household, home ownership | Next |
| Finance | `/diagnosis/finance` | Employment, income, available funds, repayment budget | Next |
| Credit | `/diagnosis/credit` | Repeatable debt cards, credit score, delinquency | Next |
| House | `/diagnosis/house` | Region, property type, price, optional appraisal | Next |
| Loan | `/diagnosis/loan` | Requested amount, term, rate, rate type, amortization | Diagnose |
| Results | `/diagnosis/result` | Summary + tabs: overview, details, simulation, cautions | Modify inputs |

## Common UX
- Show progress through five input steps and the result step.
- Back/next preserves data in memory; validation errors appear next to fields.
- Currency: KRW with separators and explicit units; percentages show `%`.
- Conditional inputs appear only when applicable; no silent changes to requested loan amount.
- Result tabs: funding breakdown; LTV/DSR with assumptions and source; monthly payment; scenarios.
- Status text: reviewable, funding shortfall, regulatory limit, repayment burden, needs verification, credit risk. Multiple reasons can coexist.
- On reload, inputs reset. Reset clears all financial inputs and outputs.
- Mobile: single-column form, full-width CTA; desktop: centered cards, 2–3 column results.
