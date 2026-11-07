import { beforeEach, describe, expect, it } from 'vitest'
import { creditSchema, emptyCredit, emptyLoan } from './credit'
import { accessibleDiagnosisStep, useDiagnosisStore } from '../store/diagnosis'
import { emptyFinance } from './finance'

const basic = { age: '35', maritalStatus: 'single', homeCount: '0', firstTimeBuyer: 'yes' }
const finance = { ...emptyFinance, employmentType: 'employee', annualIncome: '0', incomeProof: 'available', cash: '0', monthlyBudget: '0' }
const credit = { ...emptyCredit, hasLoans: 'no', bureau: 'KCB', score: '800', delinquency: 'no', debtAdjustment: 'no' }
const loan = { ...emptyLoan, type: 'credit', balance: '1,000,000', annualRate: '4.25', remainingMonths: '12', repaymentMethod: 'bullet', plannedPayoff: 'yes' }
beforeEach(() => useDiagnosisStore.setState(useDiagnosisStore.getInitialState(), true))

describe('부채·신용 입력 검증', () => {
  it('대출 없음과 여러 대출, 0 금리·잔액을 허용한다', () => {
    expect(creditSchema.safeParse(credit).success).toBe(true)
    expect(creditSchema.safeParse({ ...credit, hasLoans: 'yes', loans: [loan, { ...loan, balance: '0', annualRate: '0' }] }).success).toBe(true)
  })
  it.each(['hasLoans', 'bureau', 'score', 'delinquency', 'debtAdjustment'])('필수 항목 %s를 검증한다', (key) => {
    expect(creditSchema.safeParse({ ...credit, [key]: '' }).success).toBe(false)
    expect(creditSchema.safeParse({ ...credit, [key]: 'invalid' }).success).toBe(false)
  })
  it('대출 있음에는 한 개 이상의 유효한 대출이 필요하다', () => {
    expect(creditSchema.safeParse({ ...credit, hasLoans: 'yes' }).success).toBe(false)
    for (const key of ['type', 'balance', 'annualRate', 'remainingMonths', 'repaymentMethod', 'plannedPayoff']) {
      expect(creditSchema.safeParse({ ...credit, hasLoans: 'yes', loans: [{ ...loan, [key]: '' }] }).success).toBe(false)
    }
  })
  it.each([
    ['balance', '-1'], ['balance', '1,00'], ['balance', '1.5'], ['balance', '9007199254740992'],
    ['annualRate', '-1'], ['annualRate', 'Infinity'], ['annualRate', 'abc'],
    ['remainingMonths', '0'], ['remainingMonths', '1.5'], ['remainingMonths', '9007199254740992'],
  ])('잘못된 %s 값 %s를 거부한다', (key, value) => {
    expect(creditSchema.safeParse({ ...credit, hasLoans: 'yes', loans: [{ ...loan, [key]: value }] }).success).toBe(false)
  })
  it('한도대출의 한도를 검증하고 해당하지 않는 입력을 제외한다', () => {
    expect(creditSchema.safeParse({ ...credit, hasLoans: 'yes', loans: [{ ...loan, type: 'creditLine' }] }).success).toBe(false)
    expect(creditSchema.parse({ ...credit, hasLoans: 'yes', loans: [{ ...loan, type: 'creditLine', creditLimit: '2,000,000' }] }).loans[0].creditLimit).toBe('2,000,000')
    expect(creditSchema.parse({ ...credit, hasLoans: 'yes', loans: [{ ...loan, creditLimit: 'invalid' }] }).loans[0].creditLimit).toBe('')
    expect(creditSchema.parse({ ...credit, loans: [emptyLoan] }).loans).toEqual([])
  })
})

describe('3단계 완료와 무효화', () => {
  const completePrevious = () => {
    useDiagnosisStore.getState().completeBasic(basic)
    useDiagnosisStore.getState().completeFinance(finance)
  }
  it('1~3단계를 모두 완료해야 4단계를 연다', () => {
    expect(useDiagnosisStore.getState().completeCredit(credit)).toBe(false)
    useDiagnosisStore.getState().completeBasic(basic)
    expect(useDiagnosisStore.getState().completeCredit(credit)).toBe(false)
    completePrevious()
    expect(useDiagnosisStore.getState().completeCredit({ ...credit, score: '' })).toBe(false)
    expect(useDiagnosisStore.getState().completeCredit(credit)).toBe(true)
    expect(accessibleDiagnosisStep(true, true, true)).toBe(3)
    expect(accessibleDiagnosisStep(false, true, true)).toBe(0)
    expect(accessibleDiagnosisStep(true, false, true)).toBe(1)
    expect(accessibleDiagnosisStep(true, true, false)).toBe(2)
  })
  it('초안의 추가·삭제와 미완성 값을 메모리에 보존한다', () => {
    const draft = { ...credit, hasLoans: 'yes', loans: [loan, { ...emptyLoan }] }
    useDiagnosisStore.getState().saveCreditDraft(draft)
    expect(useDiagnosisStore.getState().credit).toEqual(draft)
    useDiagnosisStore.getState().saveCreditDraft({ ...draft, loans: [loan] })
    expect(useDiagnosisStore.getState().credit.loans).toEqual([loan])
  })
  it.each(['credit', 'finance', 'basic'])('%s 변경은 4단계를 잠그고 신용 초안을 보존한다', (step) => {
    completePrevious()
    useDiagnosisStore.getState().completeCredit(credit)
    if (step === 'credit') useDiagnosisStore.getState().saveCreditDraft({ ...credit, score: '' })
    if (step === 'finance') useDiagnosisStore.getState().saveFinanceDraft({ ...finance, cash: '' })
    if (step === 'basic') useDiagnosisStore.getState().saveBasicDraft({ ...basic, age: '' })
    expect(useDiagnosisStore.getState().creditCompleted).toBe(false)
    expect(useDiagnosisStore.getState().credit.bureau).toBe('KCB')
  })
  it('선행 입력 재제출과 초기화 상태를 처리한다', () => {
    completePrevious()
    useDiagnosisStore.getState().completeCredit(credit)
    completePrevious()
    expect(useDiagnosisStore.getState().creditCompleted).toBe(true)
    useDiagnosisStore.getState().completeFinance({ ...finance, cash: '1' })
    expect(useDiagnosisStore.getState().creditCompleted).toBe(false)
    useDiagnosisStore.setState(useDiagnosisStore.getInitialState(), true)
    expect(useDiagnosisStore.getState().credit).toEqual(emptyCredit)
  })
})
