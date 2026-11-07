import { z } from 'zod'
import { houseSchema } from '../validation/house'
import { loanConditionsSchema } from '../validation/loan'
import { buildDiagnosisResult } from './diagnosis'
import type { DiagnosisInputs, ResultValue } from './diagnosis'

export type ScenarioDraft = { purchasePrice: string; requestedAmount: string; annualRate: string; termYears: string }
export function createScenarioDraft(original: DiagnosisInputs): ScenarioDraft {
  return { purchasePrice: original.house.purchasePrice, requestedAmount: original.loan.requestedAmount, annualRate: original.loan.annualRate, termYears: original.loan.termYears }
}
export function createScenarioSchema(original: DiagnosisInputs) {
  return z.object({ purchasePrice: z.string(), requestedAmount: z.string(), annualRate: z.string(), termYears: z.string() }).superRefine((values, context) => {
    const house = houseSchema.safeParse({ ...original.house, purchasePrice: values.purchasePrice })
    const loan = loanConditionsSchema.safeParse({ ...original.loan, requestedAmount: values.requestedAmount, annualRate: values.annualRate, termYears: values.termYears })
    if (!house.success) for (const issue of house.error.issues) context.addIssue({ code: 'custom', path: ['purchasePrice'], message: issue.message })
    if (!loan.success) for (const issue of loan.error.issues) context.addIssue({ code: 'custom', path: [issue.path[0] === 'fixedRateYears' ? 'termYears' : String(issue.path[0])], message: issue.message })
  })
}
export type ComparisonRow = {
  key: string; label: string; unit: 'money' | 'percent' | 'years'
  original: ResultValue<number>; simulated: ResultValue<number>; difference: ResultValue<number>
}
type ReadyResult = Extract<ReturnType<typeof buildDiagnosisResult>, { status: 'READY' }>
const available = (value: number): ResultValue<number> => ({ status: 'AVAILABLE', value })
function metrics(result: ReadyResult) {
  const funding = (key: 'totalCost' | 'minimumFundingNeed'): ResultValue<number> => result.funding.status === 'AVAILABLE' ? available(result.funding.value[key]) : result.funding
  const repayment = (key: 'firstPayment' | 'lastPayment' | 'totalInterest' | 'totalPayment'): ResultValue<number> => result.repayment.status === 'AVAILABLE' ? available(result.repayment.value[key]) : result.repayment
  return {
    purchasePrice: available(result.purchasePrice), requestedAmount: available(Number(result.loan.requestedAmount.replaceAll(',', ''))), annualRate: available(Number(result.loan.annualRate)), termYears: available(Number(result.loan.termYears)),
    totalCost: funding('totalCost'), ownFunds: result.ownFunds, fundingNeed: funding('minimumFundingNeed'), fundingGap: result.fundingGap,
    firstPayment: repayment('firstPayment'), lastPayment: repayment('lastPayment'), totalInterest: repayment('totalInterest'), totalPayment: repayment('totalPayment'),
    ltv: result.mathematicalLtv, regulatoryLtv: result.regulatoryLtv, dsr: result.dsr, stressDsr: result.stressDsr,
  }
}
const definitions: [keyof ReturnType<typeof metrics>, string, ComparisonRow['unit']][] = [
  ['purchasePrice', '매매가격', 'money'], ['requestedAmount', '희망 대출금액', 'money'], ['annualRate', '가정 연이율', 'percent'], ['termYears', '대출 기간', 'years'],
  ['totalCost', '총 구입 비용 (추정)', 'money'], ['ownFunds', '사용 가능 자기자금', 'money'], ['fundingNeed', '자기자금 차감 후 필요자금', 'money'], ['fundingGap', '대출 조달 후 부족자금', 'money'],
  ['firstPayment', '첫 달 상환액 (추정)', 'money'], ['lastPayment', '마지막 달 상환액 (추정)', 'money'], ['totalInterest', '총 이자 (추정)', 'money'], ['totalPayment', '총 상환액 (추정)', 'money'],
  ['ltv', '수학적 LTV', 'percent'], ['regulatoryLtv', '규제 LTV 한도', 'percent'], ['dsr', 'DSR', 'percent'], ['stressDsr', '스트레스 DSR', 'percent'],
]

/** Reuse result mapping on copies. Unknown costs/collateral/income/rules stay unknown. */
export function buildScenarioComparison(original: DiagnosisInputs, draft: ScenarioDraft, asOf: string) {
  const parsed = createScenarioSchema(original).safeParse(draft)
  if (!parsed.success) return { status: 'INVALID_INPUT' as const, issues: parsed.error.issues }
  const baseline = buildDiagnosisResult(original, asOf)
  const simulated = buildDiagnosisResult({ ...original, house: { ...original.house, purchasePrice: parsed.data.purchasePrice }, loan: { ...original.loan, requestedAmount: parsed.data.requestedAmount, annualRate: parsed.data.annualRate, termYears: parsed.data.termYears } }, asOf)
  if (baseline.status !== 'READY' || simulated.status !== 'READY') return { status: 'INVALID_ORIGINAL' as const }
  const before = metrics(baseline)
  const after = metrics(simulated)
  const rows: ComparisonRow[] = definitions.map(([key, label, unit]) => {
    const first = before[key]
    const second = after[key]
    return { key, label, unit, original: first, simulated: second, difference: first.status === 'AVAILABLE' && second.status === 'AVAILABLE'
      ? available(second.value - first.value) : { status: 'NEEDS_VERIFICATION', reason: '원본 또는 시뮬레이션 값이 확인되지 않아 차이를 계산하지 않았습니다.' } }
  })
  return { status: 'READY' as const, rows }
}
