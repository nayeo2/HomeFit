import { describe, expect, it } from 'vitest'
import { calculateDsr, calculateRegulatoryDebtService, calculateStressRate, compareDsrLimit } from './dsr'
import type { RegulatoryDebt } from './dsr'
import type { DebtServiceRule, DsrContext, DsrLimitRule, StressDsrRule } from '../regulations/dsr'
import { calculateRepayment } from './finance'

// Fictional test-only parameters and URLs. These are NOT Korean regulatory rules.
const metadata = {
  id: 'test-service', effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31',
  exceptions: [], source: { authority: 'FSC' as const, sourceUrl: 'https://example.invalid/test-only' },
  verification: 'verified' as const, verifiedAt: '2026-01-01', version: 'test-v1',
}
const context: DsrContext = { asOf: '2026-06-01', city: '테스트시' }
const debt: RegulatoryDebt = { id: 'one', loanType: 'credit', rateType: 'variable', balance: 120_000, annualRate: 12, remainingMonths: 12, repaymentMethod: 'bullet', payoff: 'none' }
const service: DebtServiceRule = {
  ...metadata, conditions: { loanType: ['credit'] },
  value: { kind: 'debtService', treatment: { method: 'principalOverYearsPlusInterest', principalBasis: 'balance', interestBasis: 'balance', recognizedYears: 2 }, plannedPayoff: 'include', confirmedPayoff: 'exclude' },
}
const stressRule: StressDsrRule = {
  ...metadata, id: 'test-stress', conditions: { rateType: ['variable'] },
  value: { kind: 'stressRate', method: 'additive', marginPercentagePoints: 2, applicationFactor: 0.5 },
}

describe('DSR 산술 및 규제상 연간 상환액', () => {
  it('인정 소득과 규제상 연간 상환액의 비율을 계산한다', () => {
    expect(calculateDsr(60_000_000, 12_000_000)).toEqual({ status: 'AVAILABLE', ratioPercent: 20 })
    expect(calculateDsr(100, 150)).toEqual({ status: 'AVAILABLE', ratioPercent: 150 })
    expect(calculateDsr(100, 0)).toEqual({ status: 'AVAILABLE', ratioPercent: 0 })
  })
  it('소득 0은 부채 0이어도 비율을 확정하지 않는다', () => {
    expect(calculateDsr(0, 0)).toEqual({ status: 'NEEDS_VERIFICATION', reason: 'ZERO_RECOGNIZED_INCOME' })
    expect(calculateDsr(0, 100).status).toBe('NEEDS_VERIFICATION')
    expect(calculateDsr(null, 100)).toMatchObject({ reason: 'MISSING_RECOGNIZED_INCOME' })
    expect(calculateDsr(100, null)).toMatchObject({ reason: 'MISSING_REGULATORY_DEBT_SERVICE' })
  })
  it.each([-1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('잘못된 입력 %s를 거부한다', (value) => {
    expect(() => calculateDsr(value, 0)).toThrow(RangeError)
    expect(() => calculateDsr(1, value)).toThrow(RangeError)
  })
  it('복수 대출의 잔액·한도 처리와 실제 상환액을 분리한다', () => {
    const lineRule: DebtServiceRule = { ...service, id: 'test-line', conditions: { loanType: ['creditLine'] }, value: { ...service.value, treatment: { method: 'principalOverYearsPlusInterest', principalBasis: 'creditLimit', interestBasis: 'balance', recognizedYears: 4 } } }
    const lineDebt = { ...debt, id: 'two', loanType: 'creditLine', creditLimit: 200_000, balance: 20_000, annualRate: 0 }
    const result = calculateRegulatoryDebtService([debt, lineDebt], [service, lineRule], context)
    expect(result).toMatchObject({ status: 'AVAILABLE', regulatoryAnnualDebtService: 124_400, debts: [{ regulatoryAnnualAmount: 74_400 }, { regulatoryAnnualAmount: 50_000 }] })
    expect(calculateRepayment({ principal: debt.balance, annualRate: debt.annualRate, months: debt.remainingMonths, repaymentMethod: debt.repaymentMethod }).totalPayment).toBe(134_400)
    expect(debt.annualRate).toBe(12)
  })
  it('규칙이 없는 대출 하나라도 있으면 부분 합계를 확정하지 않는다', () => {
    expect(calculateRegulatoryDebtService([debt], [], context)).toMatchObject({ reason: 'NO_APPLICABLE_RULE' })
    expect(calculateRegulatoryDebtService([debt, { ...debt, id: 'two', loanType: 'other' }], [service], context).status).toBe('NEEDS_VERIFICATION')
    expect(calculateRegulatoryDebtService([debt], [{ ...service, verification: 'unverified' }], context).status).toBe('NEEDS_VERIFICATION')
    expect(calculateRegulatoryDebtService([debt], [service, { ...service, id: 'conflict' }], context)).toMatchObject({ reason: 'AMBIGUOUS_OR_CONFLICTING_RULES' })
  })
  it('대출 없음, 원금 0, 무이자를 처리하며 한도를 잔액 0으로 대체하지 않는다', () => {
    expect(calculateRegulatoryDebtService([], [], context)).toEqual({ status: 'AVAILABLE', regulatoryAnnualDebtService: 0, debts: [] })
    expect(calculateRegulatoryDebtService([{ ...debt, balance: 0 }], [service], context)).toMatchObject({ regulatoryAnnualDebtService: 0 })
    expect(calculateRegulatoryDebtService([{ ...debt, annualRate: 0 }], [service], context)).toMatchObject({ regulatoryAnnualDebtService: 60_000 })
    const lineRule: DebtServiceRule = { ...service, value: { ...service.value, treatment: { method: 'principalOverYearsPlusInterest', principalBasis: 'creditLimit', interestBasis: 'balance', recognizedYears: 2 } } }
    expect(calculateRegulatoryDebtService([debt], [lineRule], context)).toMatchObject({ reason: 'MISSING_CREDIT_LIMIT' })
  })
  it('상환 예정만으로 제외하지 않고 검증 규칙으로 상환 시나리오를 처리한다', () => {
    expect(calculateRegulatoryDebtService([{ ...debt, payoff: 'planned' }], [service], context)).toMatchObject({ regulatoryAnnualDebtService: 74_400 })
    expect(calculateRegulatoryDebtService([{ ...debt, payoff: 'confirmed' }], [service], context)).toMatchObject({ regulatoryAnnualDebtService: 0 })
    expect(calculateRegulatoryDebtService([{ ...debt, payoff: 'planned' }], [{ ...service, value: { ...service.value, plannedPayoff: 'needsVerification' } }], context)).toMatchObject({ reason: 'PAYOFF_TREATMENT_NEEDS_VERIFICATION' })
    expect(calculateRegulatoryDebtService([{ ...debt, payoff: 'confirmed' }], [], context).status).toBe('NEEDS_VERIFICATION')
  })
  it('명시적 제외 규칙과 제공된 규제 인정액을 지원한다', () => {
    const provided: DebtServiceRule = { ...service, value: { ...service.value, treatment: { method: 'providedAnnualAmount' } } }
    expect(calculateRegulatoryDebtService([debt], [provided], context)).toMatchObject({ reason: 'MISSING_REGULATORY_DEBT_SERVICE' })
    expect(calculateRegulatoryDebtService([{ ...debt, providedRegulatoryAnnualAmount: 123.5 }], [provided], context)).toMatchObject({ regulatoryAnnualDebtService: 123.5 })
    const excluded: DebtServiceRule = { ...service, value: { ...service.value, treatment: { method: 'excluded' } } }
    expect(calculateRegulatoryDebtService([debt], [excluded], context)).toMatchObject({ regulatoryAnnualDebtService: 0 })
  })
  it('검증 규칙이 지정할 때만 첫 12회 실제 스케줄을 인정액으로 사용한다', () => {
    const scheduled: DebtServiceRule = { ...service, value: { ...service.value, treatment: { method: 'scheduledFirstYear' } } }
    expect(calculateRegulatoryDebtService([debt], [scheduled], context)).toMatchObject({ regulatoryAnnualDebtService: 134_400 })
    const input = { ...debt, remainingMonths: 6, annualRate: 0, repaymentMethod: 'equalPrincipal' as const }
    expect(calculateRegulatoryDebtService([input], [scheduled], context)).toMatchObject({ regulatoryAnnualDebtService: 120_000 })
  })
  it('중복 대출 ID·잘못된 기간·처리 파라미터를 거부한다', () => {
    expect(calculateRegulatoryDebtService([debt, debt], [service], context)).toMatchObject({ reason: 'DUPLICATE_OR_MISSING_DEBT_ID' })
    for (const remainingMonths of [0, -1, 1.5, Infinity]) expect(() => calculateRegulatoryDebtService([{ ...debt, remainingMonths }], [service], context)).toThrow(RangeError)
    for (const recognizedYears of [0, -1, NaN, Infinity]) {
      const invalid: DebtServiceRule = { ...service, value: { ...service.value, treatment: { method: 'principalOverYearsPlusInterest', principalBasis: 'balance', interestBasis: 'balance', recognizedYears } } }
      expect(calculateRegulatoryDebtService([debt], [invalid], context)).toMatchObject({ reason: 'INVALID_DEBT_SERVICE_PARAMETERS' })
    }
  })
})

describe('스트레스 DSR 기반 구조', () => {
  it('검증된 가산율·적용계수로 심사 금리만 변경한다', () => {
    expect(calculateStressRate(4, [stressRule], { ...context, rateType: 'variable' })).toEqual({ status: 'AVAILABLE', qualifyingAnnualRate: 5, ruleId: 'test-stress', version: 'test-v1' })
    expect(calculateRegulatoryDebtService([debt], [service], context, [stressRule])).toMatchObject({ regulatoryAnnualDebtService: 75_600 })
    expect(debt.annualRate).toBe(12)
    expect(calculateRegulatoryDebtService([debt], [service], context)).toMatchObject({ regulatoryAnnualDebtService: 74_400 })
    expect(calculateStressRate(0, [{ ...stressRule, value: { ...stressRule.value, marginPercentagePoints: 0 } }], { ...context, rateType: 'variable' })).toMatchObject({ qualifyingAnnualRate: 0 })
  })
  it('누락·미검증·적용 불가·중복 스트레스 규칙을 거부한다', () => {
    expect(calculateStressRate(4, [], context).status).toBe('NEEDS_VERIFICATION')
    expect(calculateStressRate(4, [stressRule], context)).toMatchObject({ reason: 'UNKNOWN_APPLICABILITY' })
    expect(calculateStressRate(4, [stressRule], { ...context, rateType: 'fixed' })).toMatchObject({ reason: 'NO_APPLICABLE_RULE' })
    expect(calculateStressRate(4, [{ ...stressRule, verification: 'unverified' }], { ...context, rateType: 'variable' }).status).toBe('NEEDS_VERIFICATION')
    expect(calculateStressRate(4, [stressRule, stressRule], { ...context, rateType: 'variable' }).status).toBe('NEEDS_VERIFICATION')
    expect(calculateRegulatoryDebtService([debt], [service], context, []).status).toBe('NEEDS_VERIFICATION')
  })
  it('필수 스트레스 파라미터가 없거나 잘못되면 대체값을 넣지 않는다', () => {
    for (const value of [undefined, -1, NaN, Infinity]) {
      const invalid = { ...stressRule, value: { ...stressRule.value, applicationFactor: value } } as StressDsrRule
      expect(calculateStressRate(4, [invalid], { ...context, rateType: 'variable' })).toMatchObject({ reason: 'MISSING_OR_INVALID_STRESS_PARAMETERS' })
    }
    const provided: DebtServiceRule = { ...service, value: { ...service.value, treatment: { method: 'providedAnnualAmount' } } }
    expect(calculateRegulatoryDebtService([{ ...debt, providedRegulatoryAnnualAmount: 100 }], [provided], context, [stressRule])).toMatchObject({ reason: 'STRESSED_PROVIDED_AMOUNT_NEEDS_VERIFICATION' })
  })
  it('한도 비교에도 검증된 규칙이 필요하며 승인 판정은 하지 않는다', () => {
    const limit: DsrLimitRule = { ...metadata, conditions: {}, value: { kind: 'dsrLimit', limitPercent: 25 } }
    expect(compareDsrLimit(25, [limit], context)).toMatchObject({ status: 'AVAILABLE', exceedsLimit: false })
    expect(compareDsrLimit(26, [limit], context)).toMatchObject({ exceedsLimit: true })
    expect(compareDsrLimit(0, [], context).status).toBe('NEEDS_VERIFICATION')
  })
})
