/** Pure indicative arithmetic. Money inputs are whole KRW; annual rates are percentages.
 * Outputs retain precision: call roundKrw only at the display/export boundary.
 * No lender rounding, day-count convention, fees, rate changes or eligibility rules.
 */
export type OwnFunds = {
  cash: number
  financialAssets: number
  saleProceeds: number
  depositReturn: number
  emergencyReserve: number
}
export type FundingInput = OwnFunds & {
  purchasePrice: number
  acquisitionCosts: number
  usableLoanEstimate: number
}
export type RepaymentMethod = 'equalPayment' | 'equalPrincipal' | 'bullet'
export type RepaymentInput = {
  principal: number
  annualRate: number
  months: number
  repaymentMethod: RepaymentMethod
}

function money(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('금액은 0 이상의 안전한 정수여야 합니다.')
}
function checked(value: number) {
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) throw new RangeError('계산 가능한 숫자 범위를 벗어났습니다.')
  return value === 0 ? 0 : value
}
export function roundKrw(value: number) {
  // Nearest won; exact halves go toward +Infinity, matching Math.round.
  return checked(Math.round(checked(value)))
}

/** Inputs must not overlap. Sale proceeds are already net of sale-related debt/costs.
 * Keep negative usable funds when reserves exceed assets, as the documented formula does.
 */
export function calculateUsableFunds(input: OwnFunds) {
  const { cash, financialAssets, saleProceeds, depositReturn, emergencyReserve } = input
  for (const value of [cash, financialAssets, saleProceeds, depositReturn, emergencyReserve]) money(value)
  const grossFunds = checked(cash + financialAssets + saleProceeds + depositReturn)
  return checked(grossFunds - emergencyReserve)
}

/** Explicit acquisition costs; computes external funding need AFTER own funds,
 * independently of whether a usable loan estimate is known. No cost is inferred.
 */
export function calculatePurchaseFunding(input: Omit<FundingInput, 'usableLoanEstimate'>) {
  money(input.purchasePrice)
  money(input.acquisitionCosts)
  const totalCost = checked(input.purchasePrice + input.acquisitionCosts)
  const usableFunds = calculateUsableFunds(input)
  const minimumFundingNeed = Math.max(0, checked(totalCost - usableFunds))
  return { totalCost, usableFunds, minimumFundingNeed }
}

/** A requested loan is not an approved/usable estimate. The caller must explicitly
 * supply the usable estimate. Own funds are never subtracted a second time.
 */
export function calculateFunding(input: FundingInput) {
  money(input.usableLoanEstimate)
  const funding = calculatePurchaseFunding(input)
  const fundingGap = Math.max(0, checked(funding.totalCost - funding.usableFunds - input.usableLoanEstimate))
  return { ...funding, fundingGap }
}

function validateRepayment(input: RepaymentInput) {
  money(input.principal)
  if (!Number.isFinite(input.annualRate) || input.annualRate < 0) throw new RangeError('연이율은 0 이상의 유한한 숫자여야 합니다.')
  if (!Number.isSafeInteger(input.months) || input.months <= 0) throw new RangeError('기간은 1 이상의 안전한 정수 개월이어야 합니다.')
  if (!['equalPayment', 'equalPrincipal', 'bullet'].includes(input.repaymentMethod)) throw new RangeError('지원하지 않는 상환 방식입니다.')
}

function equalPayment(principal: number, rate: number, months: number) {
  // Equivalent to P*r*(1+r)^n/((1+r)^n-1); avoids cancellation at tiny rates.
  return rate === 0 ? principal / months : checked(principal * (rate / -Math.expm1(-months * Math.log1p(rate))))
}

/** Monthly interest on opening balance, paid at month end; bullet principal due at maturity.
 * A single constant assumed rate applies throughout, regardless of the UI's rate type.
 */
export function repaymentAtMonth(input: RepaymentInput, month: number) {
  validateRepayment(input)
  if (!Number.isSafeInteger(month) || month < 1 || month > input.months) throw new RangeError('상환 회차가 대출 기간 범위를 벗어났습니다.')
  const { principal: p, months: n, repaymentMethod: method } = input
  const r = input.annualRate / 100 / 12
  let principal: number
  let interest: number
  let remainingBalance: number
  if (method === 'bullet') {
    principal = month === n ? p : 0
    interest = checked(p * r)
    remainingBalance = month === n ? 0 : p
  } else if (method === 'equalPrincipal' || r === 0) {
    principal = p / n
    interest = checked((p * ((n - month + 1) / n)) * r)
    remainingBalance = p * ((n - month) / n)
  } else {
    const payment = equalPayment(p, r, n)
    principal = payment * Math.exp(-(n - month + 1) * Math.log1p(r))
    interest = Math.max(0, payment - principal)
    remainingBalance = month === n ? 0 : checked(payment * (-Math.expm1(-(n - month) * Math.log1p(r)) / r))
  }
  return { principal: checked(principal), interest: checked(interest), payment: checked(principal + interest), remainingBalance: checked(remainingBalance) }
}

export function calculateRepayment(input: RepaymentInput) {
  validateRepayment(input)
  const { principal, months, repaymentMethod } = input
  const r = input.annualRate / 100 / 12
  const totalInterest = checked(r === 0 ? 0 : repaymentMethod === 'bullet' ? principal * r * months
    : repaymentMethod === 'equalPrincipal' ? principal * r * ((months + 1) / 2)
      : Math.max(0, checked(equalPayment(principal, r, months) * months) - principal))
  return {
    firstPayment: repaymentAtMonth(input, 1).payment,
    lastPayment: repaymentAtMonth(input, months).payment,
    totalInterest,
    totalPayment: checked(principal + totalInterest),
  }
}
