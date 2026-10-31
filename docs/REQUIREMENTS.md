# MVP Requirements

## Goal
Help users assess whether a target home purchase is financially plausible; never predict guaranteed bank approval.

## In scope
- Anonymous browser-only SPA; no backend or DB.
- Five-step data entry, results dashboard, scenario simulation.
- Funding gap, amortization, indicative LTV/DSR and regulation checks only when rules are verified.

## Out of scope
- Loan application, real lender approval, bank API, property listings, policy-loan recommendations, accounts, server persistence.

## Inputs
| Group | Required | Conditional / optional |
|---|---|---|
| Basic | Age, marital status, household home count, first-home status | Head-of-household, dependents, children |
| Income | Employment type, annual income, proof status | Employment duration, spouse income and eligibility |
| Assets | Cash available, maximum comfortable monthly payment | Investable assets (non-duplicated), home sale proceeds, deposit return, emergency reserve |
| Debt/credit | Existing debt yes/no, credit bureau+score, delinquency/debt-adjustment status | For each debt: type, balance, rate, remaining term, repayment method, credit line limit, planned payoff |
| House | Region (city/district), property type, purchase price | Appraisal, closing date, estimated acquisition costs |
| New loan | Requested amount, term, rate assumption, rate type, repayment method | Fixed-rate period |

## Core requirements
| ID | Requirement | Priority |
|---|---|---|
| R01 | Multi-step forms with conditional fields and validation | P0 |
| R02 | Multiple existing loans, add/edit/remove | P0 |
| R03 | User-entered requested loan amount, distinct from auto-computed funding need | P0 |
| R04 | Calculate acquisition cost, usable funds, funding gap | P0 |
| R05 | Calculate monthly payment and indicative LTV/DSR | P0 |
| R06 | Regulation evaluator with effective date, source, uncertainty | P0 |
| R07 | Results: funding, regulation, repayment burden, reasons | P0 |
| R08 | Scenario comparison: price, funds, loan, rate, term | P1 |
| R09 | Responsive desktop/mobile UI | P0 |
| R10 | Client-memory-only handling, reset and reload clearing data | P0 |
| R11 | Optional local PDF export | P2 |

## Acceptance
- Users can complete all five input steps and see a result without a server.
- Financial changes recompute relevant outputs.
- Missing appraisal/rules show assumptions or `NEEDS_VERIFICATION` rather than a false approval.
- No financial data leaves the browser or persists across reload.
- Core calculation functions have tests.
