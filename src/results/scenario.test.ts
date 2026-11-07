import { describe, expect, it } from 'vitest'
import { buildScenarioComparison, createScenarioDraft, createScenarioSchema } from './scenario'
import type { ScenarioDraft } from './scenario'
import type { DiagnosisInputs } from './diagnosis'
import { emptyFinance } from '../validation/finance'
import { emptyCredit } from '../validation/credit'
import { emptyHouse } from '../validation/house'
import { emptyLoanConditions } from '../validation/loan'
import { calculateRepayment } from '../calculations/finance'
import { useDiagnosisStore } from '../store/diagnosis'

const original: DiagnosisInputs = {
  basic: { age: '35', maritalStatus: 'single', homeCount: '0', firstTimeBuyer: 'yes' },
  finance: { ...emptyFinance, employmentType: 'employee', annualIncome: '60000000', incomeProof: 'available', cash: '100000000', monthlyBudget: '2000000' },
  credit: { ...emptyCredit, hasLoans: 'no', bureau: 'KCB', score: '800', delinquency: 'no', debtAdjustment: 'no' },
  house: { ...emptyHouse, city: '서울', district: '강서구', propertyType: '아파트', purchasePrice: '500,000,000', acquisitionCosts: '10,000,000', appraisal: '400,000,000' },
  loan: { ...emptyLoanConditions, requestedAmount: '300,000,000', annualRate: '4', termYears: '30', rateType: 'variable', repaymentMethod: 'equalPayment' },
}
const asOf = '2026-11-07'
const draft = createScenarioDraft(original)
function row(key: string, change: Partial<ScenarioDraft> = {}, input = original) {
  const result = buildScenarioComparison(input, { ...createScenarioDraft(input), ...change }, asOf)
  if (result.status !== 'READY') throw new Error('Expected ready comparison')
  const value = result.rows.find((item) => item.key === key)
  if (!value) throw new Error('Missing comparison row')
  return value
}
describe('시나리오 변경·초기화·원본 보존', () => {
  it('주택가격 변경은 기존 비용을 유지하고 필요자금 차이를 계산한다', () => {
    expect(row('fundingNeed', { purchasePrice: '450,000,000' })).toMatchObject({ original: { value: 410_000_000 }, simulated: { value: 360_000_000 }, difference: { value: -50_000_000 } })
    expect(row('ownFunds', { purchasePrice: '450000000' }).difference).toMatchObject({ value: 0 })
    expect(row('ltv', { purchasePrice: '450000000' }).difference).toMatchObject({ value: 0 })
  })
  it('희망금액 변경은 상환액·LTV를 바꾸지만 필요자금·조달 가능액을 바꾸지 않는다', () => {
    expect(row('ltv', { requestedAmount: '200000000' })).toMatchObject({ original: { value: 75 }, simulated: { value: 50 }, difference: { value: -25 } })
    expect(row('fundingNeed', { requestedAmount: '200000000' }).difference).toMatchObject({ value: 0 })
    expect(row('fundingGap', { requestedAmount: '200000000' }).simulated.status).toBe('NEEDS_VERIFICATION')
    const expected = calculateRepayment({ principal: 200_000_000, annualRate: 4, months: 360, repaymentMethod: 'equalPayment' })
    expect(row('firstPayment', { requestedAmount: '200000000' }).simulated).toEqual({ status: 'AVAILABLE', value: expected.firstPayment })
  })
  it('금리·기간 변경을 기존 상환 함수에 연결하고 총 이자를 비교한다', () => {
    const change = { annualRate: '5.25', termYears: '20' }
    const expected = calculateRepayment({ principal: 300_000_000, annualRate: 5.25, months: 240, repaymentMethod: 'equalPayment' })
    expect(row('totalInterest', change).simulated).toEqual({ status: 'AVAILABLE', value: expected.totalInterest })
    expect(row('firstPayment', change).simulated).toEqual({ status: 'AVAILABLE', value: expected.firstPayment })
    expect(row('annualRate', change).difference).toMatchObject({ value: 1.25 })
    expect(row('termYears', change).difference).toMatchObject({ value: -10 })
  })
  it('0 금리·원금 및 1년을 처리한다', () => {
    const change = { requestedAmount: '0', annualRate: '0', termYears: '1' }
    expect(row('totalInterest', change).simulated).toMatchObject({ value: 0 })
    expect(row('firstPayment', change).simulated).toMatchObject({ value: 0 })
  })
  it('초기화 초안은 네 항목을 원본으로 복원하고 모든 계산 가능한 차이를 0으로 만든다', () => {
    const changed = { ...draft, purchasePrice: '1', requestedAmount: '2', annualRate: '3', termYears: '4' }
    expect(changed).not.toEqual(draft)
    const resetDraft = createScenarioDraft(original)
    expect(resetDraft).toEqual(draft)
    const result = buildScenarioComparison(original, resetDraft, asOf)
    if (result.status !== 'READY') throw new Error('Expected ready comparison')
    for (const item of result.rows) if (item.difference.status === 'AVAILABLE') expect(item.difference.value).toBe(0)
  })
  it('원본 객체·Zustand 입력·완료 상태를 변경하지 않는다', () => {
    const previousState = useDiagnosisStore.getState()
    try {
      useDiagnosisStore.setState({ ...structuredClone(original), basicCompleted: true, financeCompleted: true, creditCompleted: true, houseCompleted: true, loanCompleted: true })
      const state = useDiagnosisStore.getState()
      const snapshot = structuredClone(original)
      buildScenarioComparison(state, { ...draft, purchasePrice: '400000000', requestedAmount: '200000000', annualRate: '0', termYears: '20' }, asOf)
      expect(useDiagnosisStore.getState()).toBe(state)
      expect(original).toEqual(snapshot)
      expect(state.loanCompleted).toBe(true)
      expect(state.loan).toEqual(original.loan)
    } finally { useDiagnosisStore.setState(previousState, true) }
  })
})
describe('시나리오 검증과 확인 필요 상태', () => {
  it.each([
    ['purchasePrice', ''], ['purchasePrice', '-1'], ['purchasePrice', '1,00'], ['requestedAmount', '9007199254740992'],
    ['requestedAmount', '-1'], ['annualRate', 'abc'], ['annualRate', '-1'], ['termYears', '0'], ['termYears', '1.5'],
  ])('잘못된 %s 값 %s로 오래된 비교를 표시하지 않는다', (key, value) => {
    expect(buildScenarioComparison(original, { ...draft, [key]: value }, asOf).status).toBe('INVALID_INPUT')
  })
  it('원본 고정금리 기간보다 짧은 기간을 거부하고 원본 기간을 임의 변경하지 않는다', () => {
    const mixed = { ...original, loan: { ...original.loan, rateType: 'mixed', fixedRateYears: '10' } }
    const result = createScenarioSchema(mixed).safeParse({ ...createScenarioDraft(mixed), termYears: '5' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path).toEqual(['termYears'])
    expect(mixed.loan.fixedRateYears).toBe('10')
  })
  it('누락된 비용·담보가액·인정소득·규칙을 추정하지 않는다', () => {
    const missing = { ...original, house: { ...original.house, acquisitionCosts: '', appraisal: '' } }
    for (const key of ['fundingNeed', 'fundingGap', 'ltv', 'regulatoryLtv', 'dsr', 'stressDsr']) {
      const item = row(key, { purchasePrice: '450000000', annualRate: '3' }, missing)
      expect(item.original.status).toBe('NEEDS_VERIFICATION')
      expect(item.simulated.status).toBe('NEEDS_VERIFICATION')
      expect(item.difference.status).toBe('NEEDS_VERIFICATION')
    }
  })
  it('계산 범위 초과는 해당 항목을 확인 필요로 표시한다', () => {
    expect(row('firstPayment', { annualRate: '99999999999999999999' }).simulated.status).toBe('NEEDS_VERIFICATION')
    expect(row('firstPayment', { annualRate: '99999999999999999999' }).difference.status).toBe('NEEDS_VERIFICATION')
  })
})
