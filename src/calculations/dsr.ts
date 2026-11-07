import { repaymentAtMonth } from './finance'
import type { RepaymentMethod } from './finance'
import { selectDsrRule, unavailable } from '../regulations/dsr'
import type { DebtServiceRule, DsrContext, DsrLimitRule, StressDsrRule, Unavailable } from '../regulations/dsr'

/** Recognized income is an explicit caller input, never inferred from gross/spouse income.
 * All amounts retain fractional KRW; annual rates/margins are percent/percentage points.
 */
function amount(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) throw new RangeError('금액·금리는 계산 가능한 0 이상의 유한한 숫자여야 합니다.')
  return value
}
export function calculateDsr(annualRecognizedIncome: number | null, regulatoryAnnualDebtService: number | null): Unavailable | { status: 'AVAILABLE'; ratioPercent: number } {
  if (annualRecognizedIncome !== null) amount(annualRecognizedIncome)
  if (regulatoryAnnualDebtService !== null) amount(regulatoryAnnualDebtService)
  if (annualRecognizedIncome === null) return unavailable('MISSING_RECOGNIZED_INCOME')
  if (regulatoryAnnualDebtService === null) return unavailable('MISSING_REGULATORY_DEBT_SERVICE')
  // Even 0/0 is undefined, not a positive eligibility conclusion.
  if (annualRecognizedIncome === 0) return unavailable('ZERO_RECOGNIZED_INCOME')
  const ratioPercent = regulatoryAnnualDebtService / annualRecognizedIncome * 100
  if (!Number.isFinite(ratioPercent)) throw new RangeError('비율 계산 범위를 벗어났습니다.')
  return { status: 'AVAILABLE', ratioPercent }
}

export function calculateStressRate(baseAnnualRate: number, rules: readonly StressDsrRule[], context: DsrContext): Unavailable | { status: 'AVAILABLE'; qualifyingAnnualRate: number; ruleId: string; version: string } {
  amount(baseAnnualRate)
  const selected = selectDsrRule(rules, context)
  if (selected.status !== 'AVAILABLE') return selected
  const { value, id, version } = selected.rule
  if (value.kind !== 'stressRate' || value.method !== 'additive'
    || !Number.isFinite(value.marginPercentagePoints) || value.marginPercentagePoints < 0
    || !Number.isFinite(value.applicationFactor) || value.applicationFactor < 0) return unavailable('MISSING_OR_INVALID_STRESS_PARAMETERS')
  const qualifyingAnnualRate = amount(baseAnnualRate + value.marginPercentagePoints * value.applicationFactor)
  return { status: 'AVAILABLE', qualifyingAnnualRate, ruleId: id, version }
}

export type RegulatoryDebt = {
  id: string
  loanType: string
  rateType: string
  balance: number
  creditLimit?: number
  annualRate: number
  remainingMonths: number
  repaymentMethod: RepaymentMethod
  payoff: 'none' | 'planned' | 'confirmed'
  providedRegulatoryAnnualAmount?: number
}
type DebtServiceResult = Unavailable | {
  status: 'AVAILABLE'
  regulatoryAnnualDebtService: number
  debts: { id: string; regulatoryAnnualAmount: number; ruleId: string; version: string }[]
}

/** No actual repayment field is accepted as a regulatory amount automatically.
 * A scheduled-payment treatment is used only if a verified rule explicitly prescribes it.
 * Stress mode requires a verified rate rule per included debt; exclusions are rule-driven.
 */
export function calculateRegulatoryDebtService(debts: readonly RegulatoryDebt[], rules: readonly DebtServiceRule[], context: DsrContext, stressRules?: readonly StressDsrRule[]): DebtServiceResult {
  const results: Extract<DebtServiceResult, { status: 'AVAILABLE' }>['debts'] = []
  const ids = new Set<string>()
  // Validate the date even for an empty portfolio.
  selectDsrRule([], context)
  for (const debt of debts) {
    if (!debt.id.trim() || ids.has(debt.id)) return unavailable('DUPLICATE_OR_MISSING_DEBT_ID')
    ids.add(debt.id)
    amount(debt.balance)
    amount(debt.annualRate)
    if (debt.creditLimit !== undefined) amount(debt.creditLimit)
    if (debt.providedRegulatoryAnnualAmount !== undefined) amount(debt.providedRegulatoryAnnualAmount)
    if (!Number.isSafeInteger(debt.balance) || !Number.isSafeInteger(debt.remainingMonths) || debt.remainingMonths <= 0
      || !['equalPayment', 'equalPrincipal', 'bullet'].includes(debt.repaymentMethod)
      || !['none', 'planned', 'confirmed'].includes(debt.payoff)) throw new RangeError('대출 입력의 원금·기간·상환 상태를 확인해 주세요.')
    const debtContext = { ...context, loanType: debt.loanType, rateType: debt.rateType, repaymentMethod: debt.repaymentMethod }
    const selected = selectDsrRule(rules, debtContext)
    if (selected.status !== 'AVAILABLE') return selected
    const { value, id: ruleId, version } = selected.rule
    if (value.kind !== 'debtService') return unavailable('INVALID_DEBT_SERVICE_RULE')
    const payoffTreatment = debt.payoff === 'none' ? 'include' : debt.payoff === 'planned' ? value.plannedPayoff : value.confirmedPayoff
    if (!['include', 'exclude'].includes(payoffTreatment)) return unavailable('PAYOFF_TREATMENT_NEEDS_VERIFICATION')
    let regulatoryAnnualAmount = 0
    if (payoffTreatment !== 'exclude' && value.treatment.method !== 'excluded') {
      let rate = debt.annualRate
      if (stressRules !== undefined) {
        const stress = calculateStressRate(rate, stressRules, debtContext)
        if (stress.status !== 'AVAILABLE') return stress
        rate = stress.qualifyingAnnualRate
      }
      const treatment = value.treatment
      if (treatment.method === 'providedAnnualAmount') {
        // An unstressed provided amount cannot silently become a stress-qualified amount.
        if (stressRules !== undefined) return unavailable('STRESSED_PROVIDED_AMOUNT_NEEDS_VERIFICATION')
        if (debt.providedRegulatoryAnnualAmount === undefined) return unavailable('MISSING_REGULATORY_DEBT_SERVICE')
        regulatoryAnnualAmount = debt.providedRegulatoryAnnualAmount
      } else if (treatment.method === 'principalOverYearsPlusInterest') {
        if (!Number.isFinite(treatment.recognizedYears) || treatment.recognizedYears <= 0
          || !['balance', 'creditLimit'].includes(treatment.principalBasis)
          || !['balance', 'creditLimit'].includes(treatment.interestBasis)) return unavailable('INVALID_DEBT_SERVICE_PARAMETERS')
        const principalBase = debt[treatment.principalBasis]
        const interestBase = debt[treatment.interestBasis]
        if (principalBase === undefined || interestBase === undefined) return unavailable('MISSING_CREDIT_LIMIT')
        regulatoryAnnualAmount = amount(principalBase / treatment.recognizedYears + interestBase * (rate / 100))
      } else if (treatment.method === 'scheduledFirstYear') {
        for (let month = 1; month <= Math.min(12, debt.remainingMonths); month++) {
          regulatoryAnnualAmount = amount(regulatoryAnnualAmount + repaymentAtMonth({ principal: debt.balance, annualRate: rate, months: debt.remainingMonths, repaymentMethod: debt.repaymentMethod }, month).payment)
        }
      } else return unavailable('UNSUPPORTED_DEBT_SERVICE_TREATMENT')
    }
    results.push({ id: debt.id, regulatoryAnnualAmount, ruleId, version })
  }
  return { status: 'AVAILABLE', regulatoryAnnualDebtService: results.reduce((sum, item) => amount(sum + item.regulatoryAnnualAmount), 0), debts: results }
}

/** Threshold comparisons require an explicit verified rule; no approval decision is made. */
export function compareDsrLimit(ratioPercent: number, rules: readonly DsrLimitRule[], context: DsrContext): Unavailable | { status: 'AVAILABLE'; exceedsLimit: boolean; limitPercent: number; ruleId: string; version: string } {
  amount(ratioPercent)
  const selected = selectDsrRule(rules, context)
  if (selected.status !== 'AVAILABLE') return selected
  const { value, id, version } = selected.rule
  if (value.kind !== 'dsrLimit' || !Number.isFinite(value.limitPercent) || value.limitPercent < 0) return unavailable('INVALID_DSR_LIMIT')
  return { status: 'AVAILABLE', exceedsLimit: ratioPercent > value.limitPercent, limitPercent: value.limitPercent, ruleId: id, version }
}
