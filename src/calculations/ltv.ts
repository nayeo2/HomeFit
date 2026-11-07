/** Mathematical LTV only; never an eligibility or approval decision.
 * Missing collateral is never silently replaced with the purchase price.
 */
export type CollateralValue = { amount: number; basis: 'appraisal' | 'purchasePriceAssumption' }
export type LtvInput = {
  purchasePrice: number
  requestedLoanAmount: number
  collateralValue: CollateralValue | null
}
type Unavailable = { status: 'NEEDS_VERIFICATION'; reason: 'MISSING_COLLATERAL' | 'ZERO_COLLATERAL' | 'MISSING_LTV_LIMIT' }

function money(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('금액은 0 이상의 안전한 정수여야 합니다.')
}
function collateralIssue(collateral: CollateralValue | null): Unavailable | null {
  if (collateral === null) return { status: 'NEEDS_VERIFICATION', reason: 'MISSING_COLLATERAL' }
  money(collateral.amount)
  if (!['appraisal', 'purchasePriceAssumption'].includes(collateral.basis)) throw new RangeError('담보가액 기준을 명시해 주세요.')
  return collateral.amount === 0 ? { status: 'NEEDS_VERIFICATION', reason: 'ZERO_COLLATERAL' } : null
}

export function calculateLtv(input: LtvInput): Unavailable | { status: 'AVAILABLE'; ratioPercent: number; basis: CollateralValue['basis'] } {
  money(input.purchasePrice)
  money(input.requestedLoanAmount)
  const issue = collateralIssue(input.collateralValue)
  if (issue) return issue
  const collateral = input.collateralValue!
  return { status: 'AVAILABLE', ratioPercent: input.requestedLoanAmount / collateral.amount * 100, basis: collateral.basis }
}

/** Caller supplies a percentage, not a fraction. No regulatory percentage is bundled.
 * Retains fractional KRW, consistent with the existing arithmetic engine.
 */
export function calculateLtvLoanLimit(collateral: CollateralValue | null, applicableLtvLimitPercent: number | null): Unavailable | { status: 'AVAILABLE'; loanLimit: number; basis: CollateralValue['basis'] } {
  if (applicableLtvLimitPercent !== null && (!Number.isFinite(applicableLtvLimitPercent) || applicableLtvLimitPercent < 0)) throw new RangeError('LTV 한도율은 0 이상의 유한한 숫자여야 합니다.')
  const issue = collateralIssue(collateral)
  if (issue) return issue
  if (applicableLtvLimitPercent === null) return { status: 'NEEDS_VERIFICATION', reason: 'MISSING_LTV_LIMIT' }
  const loanLimit = collateral!.amount * (applicableLtvLimitPercent / 100)
  if (!Number.isFinite(loanLimit) || loanLimit > Number.MAX_SAFE_INTEGER) throw new RangeError('계산 가능한 숫자 범위를 벗어났습니다.')
  return { status: 'AVAILABLE', loanLimit, basis: collateral!.basis }
}
