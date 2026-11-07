import { basicSchema } from '../validation/basic'
import type { BasicDraft } from '../validation/basic'
import { createFinanceSchema } from '../validation/finance'
import type { FinanceDraft } from '../validation/finance'
import { creditSchema } from '../validation/credit'
import type { CreditDraft } from '../validation/credit'
import { houseSchema } from '../validation/house'
import type { HouseDraft } from '../validation/house'
import { loanConditionsSchema } from '../validation/loan'
import type { LoanConditionsDraft } from '../validation/loan'
import { calculatePurchaseFunding, calculateRepayment, calculateUsableFunds } from '../calculations/finance'
import type { RepaymentMethod } from '../calculations/finance'
import { calculateLtv } from '../calculations/ltv'
import { selectLtvRule } from '../regulations/ltv'
import { calculateDsr, calculateStressRate } from '../calculations/dsr'

export type DiagnosisInputs = { basic: BasicDraft; finance: FinanceDraft; credit: CreditDraft; house: HouseDraft; loan: LoanConditionsDraft }
export type ResultValue<T> = { status: 'AVAILABLE'; value: T } | { status: 'NEEDS_VERIFICATION'; reason: string }
const available = <T>(value: T): ResultValue<T> => ({ status: 'AVAILABLE', value })
const missing = (reason: string): { status: 'NEEDS_VERIFICATION'; reason: string } => ({ status: 'NEEDS_VERIFICATION', reason })
function safely<T>(calculate: () => T): ResultValue<T> {
  try { return available(calculate()) } catch (error) {
    if (!(error instanceof RangeError)) throw error
    return missing('입력값이 계산 가능한 범위를 벗어났습니다. 해당 입력을 확인해 주세요.')
  }
}
const numeric = (value: string) => Number(value.replaceAll(',', ''))

/** Revalidate memory drafts. Optional asset blanks are omitted from own funds (0),
 * but unknown costs, collateral, recognized income and usable loan are NEVER imputed.
 * No production verified rules/recognized-income evidence are bundled in this app.
 */
export function buildDiagnosisResult(inputs: DiagnosisInputs, asOf: string) {
  const basic = basicSchema.safeParse(inputs.basic)
  if (!basic.success) return { status: 'INVALID_INPUT' as const }
  const finance = createFinanceSchema(basic.data).safeParse(inputs.finance)
  const credit = creditSchema.safeParse(inputs.credit)
  const house = houseSchema.safeParse(inputs.house)
  const loan = loanConditionsSchema.safeParse(inputs.loan)
  if (!finance.success || !credit.success || !house.success || !loan.success) return { status: 'INVALID_INPUT' as const }
  const f = finance.data
  const h = house.data
  const l = loan.data
  const funds = { cash: numeric(f.cash), financialAssets: numeric(f.financialAssets), saleProceeds: numeric(f.saleProceeds), depositReturn: numeric(f.depositReturn), emergencyReserve: numeric(f.emergencyReserve) }
  const context = { asOf, city: h.city, district: h.district, propertyType: h.propertyType, homeCount: numeric(basic.data.homeCount), firstTimeBuyer: basic.data.firstTimeBuyer === 'unknown' ? undefined : basic.data.firstTimeBuyer === 'yes' }
  const funding = h.acquisitionCosts === '' ? missing('예상 취득 비용이 입력되지 않아 총비용과 필요자금을 확정할 수 없습니다.')
    : safely(() => calculatePurchaseFunding({ ...funds, purchasePrice: numeric(h.purchasePrice), acquisitionCosts: numeric(h.acquisitionCosts) }))
  const ltv = safely(() => calculateLtv({ purchasePrice: numeric(h.purchasePrice), requestedLoanAmount: numeric(l.requestedAmount), collateralValue: h.appraisal === '' ? null : { amount: numeric(h.appraisal), basis: 'appraisal' } }))
  const mathematicalLtv: ResultValue<number> = ltv.status !== 'AVAILABLE' ? ltv : ltv.value.status === 'AVAILABLE' ? available(ltv.value.ratioPercent) : missing('감정평가액이 없거나 0이므로 수학적 LTV를 계산하지 않았습니다. 매매가격으로 대체하지 않습니다.')
  const regulatoryLtv = selectLtvRule([], context)
  const dsr = calculateDsr(null, null)
  const stress = safely(() => calculateStressRate(numeric(l.annualRate), [], { ...context, loanType: 'mortgage', rateType: l.rateType, repaymentMethod: l.repaymentMethod }))
  return {
    status: 'READY' as const,
    purchasePrice: numeric(h.purchasePrice), acquisitionCosts: h.acquisitionCosts === '' ? null : numeric(h.acquisitionCosts),
    ownFunds: safely(() => calculateUsableFunds(funds)), funding,
    fundingGap: missing('실제 사용 가능한 대출 추정액이 확인되지 않아 부족자금을 산출하지 않았습니다. 희망 대출금액은 승인·조달 금액이 아닙니다.'),
    loan: l,
    repayment: safely(() => calculateRepayment({ principal: numeric(l.requestedAmount), annualRate: numeric(l.annualRate), months: numeric(l.termYears) * 12, repaymentMethod: l.repaymentMethod as RepaymentMethod })),
    mathematicalLtv,
    regulatoryLtv: { ...missing('적용 가능한 검증된 LTV 규칙이 제공되지 않았습니다. 규제 한도와 대출 자격은 금융기관 확인이 필요합니다.'), code: regulatoryLtv.status === 'NEEDS_VERIFICATION' ? regulatoryLtv.reason : undefined },
    dsr: { ...missing('검증된 인정 연소득과 대출별 규제상 연간 상환액·적용 규칙이 없습니다. 입력한 연소득이나 실제 상환액을 대신 사용하지 않습니다.'), code: dsr.status === 'NEEDS_VERIFICATION' ? dsr.reason : undefined },
    stressDsr: { ...missing('DSR 인정 입력과 검증된 스트레스 금리·적용계수가 없어 스트레스 DSR을 계산하지 않았습니다.'), code: stress.status === 'NEEDS_VERIFICATION' ? stress.reason : stress.value.status === 'NEEDS_VERIFICATION' ? stress.value.reason : undefined },
    creditRisk: credit.data.delinquency === 'yes' || credit.data.debtAdjustment === 'yes',
    existingLoanCount: credit.data.loans.length,
  }
}
