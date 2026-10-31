# Financial Logic and Regulation Rules

## Important
No verified 2026 Korean regulatory constants are bundled here. Never hardcode an assumed LTV/DSR threshold as law. Verify dated official regulations before enabling regulatory conclusions.

## Core calculations
| Key | Definition |
|---|---|
| totalCost | purchasePrice + acquisitionCosts |
| usableFunds | non-overlapping cash + investable amount + net sale proceeds + recoverable deposit - reserved funds |
| minimumFundingNeed | max(0, totalCost - usableFunds) |
| requestedLtv | requestedLoan / eligibleAppraisal * 100 (when appraisal known; else label assumption) |
| monthlyPayment | For equal payments: P*r*(1+r)^n / ((1+r)^n - 1), r=annualRate/12, n=months; if r=0, P/n |
| indicativeDsr | annual regulatory debt-service amount / eligibleAnnualIncome * 100 |
| regulatoryCeiling | min of *applicable, verified* LTV, DSR, and other ceilings |
| fundingGap | max(0, totalCost - usableFunds - usableLoanEstimate) |
| budgetGap | monthlyPayment - userMonthlyRepaymentBudget |

## Critical distinctions
- Actual cash payment != regulatory DSR-recognized debt service.
- Stress DSR changes qualifying calculations, not necessarily the actual interest paid.
- Existing credit lines and bullet loans require category-specific treatment.
- Spouse income cannot always be combined; determine applicable borrower/product conditions.
- Home location, property type, ownership, effective date, appraisal, and exceptions affect rules.
- Never equate indicative ceiling with lender approval. Never invent a probability.

## Diagnosis statuses
`CONDITIONALLY_FEASIBLE`, `FUNDING_SHORTFALL`, `REGULATORY_LIMIT`, `REPAYMENT_BURDEN`, `NEEDS_VERIFICATION`, `CREDIT_RISK_FLAG`.
Return multiple flags and plain-Korean reasons; unresolved inputs must not produce a definitive positive verdict.

## Rule metadata
Each regulation: `id`, `effectiveFrom`, `effectiveTo?`, `region`, `conditions`, `value`, `exceptions`, `sourceUrl`, `verifiedAt`, `version`.
Use official sources (FSC, FSS, HF). No network call may contain user financial inputs.

## Tests
Zero interest, zero income, missing appraisal, multiple debts, loan payoff scenarios, changed effective dates, non-applicable regulations, stress-DSR qualification, negative/invalid input, rounding boundaries.
