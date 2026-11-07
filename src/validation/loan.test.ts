import { beforeEach, describe, expect, it } from 'vitest'
import { emptyLoanConditions, loanConditionsSchema, normalizeLoanConditions } from './loan'
import { emptyFinance } from './finance'
import { emptyCredit } from './credit'
import { emptyHouse } from './house'
import { accessibleDiagnosisStep, useDiagnosisStore } from '../store/diagnosis'

const basic = { age: '35', maritalStatus: 'single', homeCount: '0', firstTimeBuyer: 'yes' }
const finance = { ...emptyFinance, employmentType: 'employee', annualIncome: '0', incomeProof: 'available', cash: '0', monthlyBudget: '0' }
const credit = { ...emptyCredit, hasLoans: 'no', bureau: 'KCB', score: '800', delinquency: 'no', debtAdjustment: 'no' }
const house = { ...emptyHouse, city: '서울', district: '강서구', propertyType: '아파트', purchasePrice: '500000000' }
const loan = { ...emptyLoanConditions, requestedAmount: '300,000,000', annualRate: '4.25', termYears: '30', rateType: 'mixed', repaymentMethod: 'equalPayment' }
beforeEach(() => useDiagnosisStore.setState(useDiagnosisStore.getInitialState(), true))

describe('대출조건 검증', () => {
  it('쉼표 금액과 0 금리·금액, 선택 기간 공란을 허용한다', () => {
    expect(loanConditionsSchema.parse(loan)).toEqual(loan)
    expect(loanConditionsSchema.safeParse({ ...loan, requestedAmount: '0', annualRate: '0' }).success).toBe(true)
  })
  it.each(['requestedAmount', 'annualRate', 'termYears', 'rateType', 'repaymentMethod'] as const)('필수 항목 %s를 검증한다', (key) => {
    for (const value of ['', 'invalid']) expect(loanConditionsSchema.safeParse({ ...loan, [key]: value }).success).toBe(false)
  })
  it.each([
    ['requestedAmount', '-1'], ['requestedAmount', '1.5'], ['requestedAmount', '1,00'], ['requestedAmount', '9007199254740992'],
    ['annualRate', '-1'], ['annualRate', 'Infinity'], ['annualRate', '1,5'],
    ['termYears', '0'], ['termYears', '-1'], ['termYears', '1.5'], ['termYears', '9007199254740992'],
  ])('%s의 잘못된 값 %s를 거부한다', (key, value) => {
    expect(loanConditionsSchema.safeParse({ ...loan, [key]: value }).success).toBe(false)
  })
  it('금리 유형과 상환 방식의 모든 선택지를 허용한다', () => {
    for (const rateType of ['fixed', 'variable', 'mixed']) {
      for (const repaymentMethod of ['equalPayment', 'equalPrincipal', 'bullet']) {
        expect(loanConditionsSchema.safeParse({ ...loan, rateType, repaymentMethod }).success).toBe(true)
      }
    }
  })
  it('고정금리 기간을 선택적으로 검증하고 변동금리 전환 시 제거한다', () => {
    for (const rateType of ['fixed', 'mixed']) {
      for (const fixedRateYears of ['', '1', '30']) expect(loanConditionsSchema.safeParse({ ...loan, rateType, fixedRateYears }).success).toBe(true)
      for (const fixedRateYears of ['0', '-1', '1.5', '31', 'invalid']) expect(loanConditionsSchema.safeParse({ ...loan, rateType, fixedRateYears }).success).toBe(false)
    }
    expect(loanConditionsSchema.parse({ ...loan, rateType: 'variable', fixedRateYears: 'invalid' }).fixedRateYears).toBe('')
    expect(normalizeLoanConditions({ ...loan, rateType: '', fixedRateYears: '5' }).fixedRateYears).toBe('')
  })
})

describe('대출조건 초안과 결과 접근', () => {
  const completePrevious = () => {
    useDiagnosisStore.getState().completeBasic(basic)
    useDiagnosisStore.getState().completeFinance(finance)
    useDiagnosisStore.getState().completeCredit(credit)
    useDiagnosisStore.getState().completeHouse(house)
  }
  it('1~5단계를 모두 완료해야 결과를 연다', () => {
    const actions = [
      () => useDiagnosisStore.getState().completeBasic(basic),
      () => useDiagnosisStore.getState().completeFinance(finance),
      () => useDiagnosisStore.getState().completeCredit(credit),
      () => useDiagnosisStore.getState().completeHouse(house),
    ]
    for (const action of actions) {
      expect(useDiagnosisStore.getState().completeLoan(loan)).toBe(false)
      action()
    }
    expect(useDiagnosisStore.getState().completeLoan({ ...loan, requestedAmount: '' })).toBe(false)
    expect(useDiagnosisStore.getState().completeLoan(loan)).toBe(true)
    expect(accessibleDiagnosisStep(true, true, true, true, true)).toBe(5)
    for (let index = 0; index < 5; index++) {
      const flags: [boolean, boolean, boolean, boolean, boolean] = [true, true, true, true, true]
      flags[index] = false
      expect(accessibleDiagnosisStep(...flags)).toBe(index)
    }
  })
  it('미완성 초안과 요청금액을 보존하고 조건 변경 시 불필요한 기간만 비운다', () => {
    useDiagnosisStore.getState().saveLoanDraft({ ...loan, annualRate: '', fixedRateYears: '5' })
    expect(useDiagnosisStore.getState().loan).toEqual({ ...loan, annualRate: '', fixedRateYears: '5' })
    useDiagnosisStore.getState().saveLoanDraft({ ...useDiagnosisStore.getState().loan, rateType: 'variable' })
    expect(useDiagnosisStore.getState().loan.fixedRateYears).toBe('')
    expect(useDiagnosisStore.getState().loan.requestedAmount).toBe(loan.requestedAmount)
    useDiagnosisStore.setState(useDiagnosisStore.getInitialState(), true)
    expect(useDiagnosisStore.getState().loan).toEqual(emptyLoanConditions)
    expect(useDiagnosisStore.getState().loanCompleted).toBe(false)
  })
  it.each(['basic', 'finance', 'credit', 'house', 'loan'])('%s 초안 변경은 결과를 잠그고 대출 초안을 보존한다', (step) => {
    completePrevious()
    useDiagnosisStore.getState().completeLoan(loan)
    const state = useDiagnosisStore.getState()
    if (step === 'basic') state.saveBasicDraft({ ...basic, age: '' })
    if (step === 'finance') state.saveFinanceDraft({ ...finance, cash: '' })
    if (step === 'credit') state.saveCreditDraft({ ...credit, score: '' })
    if (step === 'house') state.saveHouseDraft({ ...house, city: '' })
    if (step === 'loan') state.saveLoanDraft({ ...loan, annualRate: '' })
    expect(useDiagnosisStore.getState().loanCompleted).toBe(false)
    expect(useDiagnosisStore.getState().loan.requestedAmount).toBe(loan.requestedAmount)
  })
  it('변경 없는 선행 재제출은 완료 상태를 보존한다', () => {
    completePrevious()
    useDiagnosisStore.getState().completeLoan(loan)
    completePrevious()
    expect(useDiagnosisStore.getState().loanCompleted).toBe(true)
  })
  it.each(['basic', 'finance', 'credit', 'house'])('%s 변경을 직접 제출해도 결과를 잠근다', (step) => {
    completePrevious()
    useDiagnosisStore.getState().completeLoan(loan)
    const state = useDiagnosisStore.getState()
    if (step === 'basic') state.completeBasic({ ...basic, age: '36' })
    if (step === 'finance') state.completeFinance({ ...finance, cash: '1' })
    if (step === 'credit') state.completeCredit({ ...credit, score: '801' })
    if (step === 'house') state.completeHouse({ ...house, city: '부산' })
    expect(useDiagnosisStore.getState().loanCompleted).toBe(false)
  })
  it.each(['basic', 'finance', 'credit', 'house', 'loan'])('%s 유효하지 않은 재제출은 결과를 잠근다', (step) => {
    completePrevious()
    useDiagnosisStore.getState().completeLoan(loan)
    const state = useDiagnosisStore.getState()
    if (step === 'basic') state.completeBasic({ ...basic, age: '' })
    if (step === 'finance') state.completeFinance({ ...finance, cash: '' })
    if (step === 'credit') state.completeCredit({ ...credit, score: '' })
    if (step === 'house') state.completeHouse({ ...house, city: '' })
    if (step === 'loan') state.completeLoan({ ...loan, termYears: '' })
    expect(useDiagnosisStore.getState().loanCompleted).toBe(false)
  })
})
