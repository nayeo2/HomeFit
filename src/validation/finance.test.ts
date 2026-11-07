import { beforeEach, describe, expect, it } from 'vitest'
import { createFinanceSchema, emptyFinance, financeConditions, normalizeFinance } from './finance'
import { accessibleDiagnosisStep, useDiagnosisStore } from '../store/diagnosis'

const basic = { age: '35', maritalStatus: 'married', homeCount: '1', firstTimeBuyer: 'no' }
const valid = {
  ...emptyFinance, employmentType: 'employee', annualIncome: '60,000,000',
  incomeProof: 'available', cash: '100,000,000', monthlyBudget: '2,000,000',
}
beforeEach(() => useDiagnosisStore.setState(useDiagnosisStore.getInitialState(), true))

describe('소득·자산 입력 검증', () => {
  it('쉼표 금액과 선택 항목 공란, 소득·자금 0을 허용한다', () => {
    expect(createFinanceSchema(basic).safeParse(valid).success).toBe(true)
    expect(createFinanceSchema(basic).safeParse({ ...valid, annualIncome: '0', cash: '0', monthlyBudget: '0' }).success).toBe(true)
  })
  it.each(['annualIncome', 'cash', 'monthlyBudget', 'employmentType', 'incomeProof'] as const)('필수 항목 %s 공란을 거부한다', (field) => {
    expect(createFinanceSchema(basic).safeParse({ ...valid, [field]: '' }).success).toBe(false)
  })
  it.each(['-1', '1.5', 'abc', '1,00', '9007199254740992'])('잘못된 금액 %s를 거부한다', (cash) => {
    expect(createFinanceSchema(basic).safeParse({ ...valid, cash }).success).toBe(false)
  })
  it('표시되는 선택 항목도 값이 있으면 검증한다', () => {
    for (const field of ['financialAssets', 'emergencyReserve', 'depositReturn', 'saleProceeds', 'spouseIncome', 'employmentMonths', 'spouseEligibility']) {
      expect(createFinanceSchema(basic).safeParse({ ...valid, [field]: 'invalid' }).success).toBe(false)
    }
  })
  it('기혼·주택 보유 조건을 구분하고 숨겨진 값을 제거한다', () => {
    const single = { ...basic, maritalStatus: 'single', homeCount: '0' }
    expect(financeConditions(basic)).toEqual({ spouse: true, sale: true })
    expect(financeConditions(single)).toEqual({ spouse: false, sale: false })
    const result = createFinanceSchema(single).parse({
      ...valid, spouseIncome: 'invalid', spouseEligibility: 'invalid', saleProceeds: 'invalid',
    })
    expect(result.spouseIncome).toBe('')
    expect(result.spouseEligibility).toBe('')
    expect(result.saleProceeds).toBe('')
    expect(normalizeFinance({ ...valid, saleProceeds: '123' }, basic).saleProceeds).toBe('123')
  })
})

describe('소득·자산 저장소와 단계 접근', () => {
  it('선행 단계와 유효한 입력 없이는 완료할 수 없다', () => {
    expect(useDiagnosisStore.getState().completeFinance(valid)).toBe(false)
    useDiagnosisStore.getState().completeBasic(basic)
    expect(useDiagnosisStore.getState().completeFinance({ ...valid, cash: '' })).toBe(false)
    expect(useDiagnosisStore.getState().completeFinance(valid)).toBe(true)
    expect(useDiagnosisStore.getState().finance).toEqual(valid)
  })
  it('초안을 보존하고 수정하면 3단계를 다시 잠근다', () => {
    useDiagnosisStore.getState().completeBasic(basic)
    useDiagnosisStore.getState().completeFinance(valid)
    expect(accessibleDiagnosisStep(true, true)).toBe(2)
    useDiagnosisStore.getState().saveFinanceDraft({ ...valid, cash: '' })
    expect(useDiagnosisStore.getState().finance.cash).toBe('')
    expect(useDiagnosisStore.getState().financeCompleted).toBe(false)
    expect(accessibleDiagnosisStep(true, false)).toBe(1)
    expect(accessibleDiagnosisStep(false, true)).toBe(0)
  })
  it('변경 없는 기본정보 재제출은 완료 상태를 보존한다', () => {
    useDiagnosisStore.getState().completeBasic(basic)
    useDiagnosisStore.getState().completeFinance(valid)
    useDiagnosisStore.getState().saveBasicDraft({ ...basic })
    useDiagnosisStore.getState().completeBasic({ ...basic })
    expect(useDiagnosisStore.getState().financeCompleted).toBe(true)
  })
  it('선행 답변 변경 즉시 조건부 값을 비우고 이후 완료 상태를 해제한다', () => {
    useDiagnosisStore.getState().completeBasic(basic)
    useDiagnosisStore.getState().completeFinance({
      ...valid, spouseIncome: '30000000', spouseEligibility: 'eligible', saleProceeds: '100000000',
    })
    useDiagnosisStore.getState().saveBasicDraft({ ...basic, maritalStatus: 'single', homeCount: '0' })
    const state = useDiagnosisStore.getState()
    expect(state.basicCompleted).toBe(false)
    expect(state.financeCompleted).toBe(false)
    expect(state.finance.spouseIncome).toBe('')
    expect(state.finance.spouseEligibility).toBe('')
    expect(state.finance.saleProceeds).toBe('')
    expect(state.finance.cash).toBe(valid.cash)
    useDiagnosisStore.getState().completeBasic(basic)
    expect(useDiagnosisStore.getState().finance.spouseIncome).toBe('')
  })
  it('메모리 초기 상태로 돌아가면 입력을 남기지 않는다', () => {
    useDiagnosisStore.getState().saveFinanceDraft(valid)
    useDiagnosisStore.setState(useDiagnosisStore.getInitialState(), true)
    expect(useDiagnosisStore.getState().finance).toEqual(emptyFinance)
    expect(useDiagnosisStore.getState().financeCompleted).toBe(false)
  })
})

