import { beforeEach, describe, expect, it } from 'vitest'
import { emptyHouse, houseSchema } from './house'
import { emptyFinance } from './finance'
import { emptyCredit } from './credit'
import { accessibleDiagnosisStep, useDiagnosisStore } from '../store/diagnosis'

const basic = { age: '35', maritalStatus: 'single', homeCount: '0', firstTimeBuyer: 'yes' }
const finance = { ...emptyFinance, employmentType: 'employee', annualIncome: '0', incomeProof: 'available', cash: '0', monthlyBudget: '0' }
const credit = { ...emptyCredit, hasLoans: 'no', bureau: 'KCB', score: '800', delinquency: 'no', debtAdjustment: 'no' }
const house = { ...emptyHouse, city: '서울특별시', district: '강서구', propertyType: '아파트', purchasePrice: '500,000,000' }
beforeEach(() => useDiagnosisStore.setState(useDiagnosisStore.getInitialState(), true))

describe('주택정보 검증', () => {
  it('필수 항목과 선택 항목 공란을 허용하고 문자열 공백을 정리한다', () => {
    expect(houseSchema.parse({ ...house, city: ' 서울특별시 ' })).toEqual(house)
  })
  it.each(['city', 'district', 'propertyType', 'purchasePrice'] as const)('필수 항목 %s 공란을 거부한다', (key) => {
    expect(houseSchema.safeParse({ ...house, [key]: '' }).success).toBe(false)
    expect(houseSchema.safeParse({ ...house, [key]: ' ' }).success).toBe(false)
  })
  it.each(['purchasePrice', 'appraisal', 'acquisitionCosts'] as const)('%s 금액 형식을 검증한다', (key) => {
    for (const value of ['0', '100000', '100,000']) {
      expect(houseSchema.safeParse({ ...house, [key]: value }).success).toBe(true)
    }
    for (const value of ['-1', '1.5', '1,00', 'abc', '9007199254740992']) {
      expect(houseSchema.safeParse({ ...house, [key]: value }).success).toBe(false)
    }
  })
  it('잔금일은 선택이며 실제 달력 날짜만 허용한다', () => {
    for (const closingDate of ['', '2028-02-29', '2026-11-07']) {
      expect(houseSchema.safeParse({ ...house, closingDate }).success).toBe(true)
    }
    for (const closingDate of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-1-1', '0000-01-01', 'invalid']) {
      expect(houseSchema.safeParse({ ...house, closingDate }).success).toBe(false)
    }
  })
  it('문서에 없는 표시 조건을 적용하지 않고 선택 값을 보존하거나 명시적으로 비울 수 있다', () => {
    const optional = { appraisal: '480,000,000', closingDate: '2026-12-01', acquisitionCosts: '10,000,000' }
    expect(houseSchema.parse({ ...house, ...optional })).toEqual({ ...house, ...optional })
    expect(houseSchema.parse({ ...house, ...optional, propertyType: '단독주택', city: '세종특별자치시' })).toMatchObject(optional)
    expect(houseSchema.parse({ ...house, ...optional, appraisal: '', closingDate: '', acquisitionCosts: '' })).toEqual(house)
  })
})

describe('4단계 완료와 이후 단계 접근', () => {
  const completePrevious = () => {
    useDiagnosisStore.getState().completeBasic(basic)
    useDiagnosisStore.getState().completeFinance(finance)
    useDiagnosisStore.getState().completeCredit(credit)
  }
  it('1~4단계가 모두 유효해야 5단계를 연다', () => {
    expect(useDiagnosisStore.getState().completeHouse(house)).toBe(false)
    useDiagnosisStore.getState().completeBasic(basic)
    expect(useDiagnosisStore.getState().completeHouse(house)).toBe(false)
    useDiagnosisStore.getState().completeFinance(finance)
    expect(useDiagnosisStore.getState().completeHouse(house)).toBe(false)
    completePrevious()
    expect(useDiagnosisStore.getState().completeHouse({ ...house, city: '' })).toBe(false)
    expect(useDiagnosisStore.getState().completeHouse(house)).toBe(true)
    expect(accessibleDiagnosisStep(true, true, true, true)).toBe(4)
    expect(accessibleDiagnosisStep(true, true, true, false)).toBe(3)
    expect(accessibleDiagnosisStep(true, true, false, true)).toBe(2)
    expect(accessibleDiagnosisStep(true, false, true, true)).toBe(1)
    expect(accessibleDiagnosisStep(false, true, true, true)).toBe(0)
  })
  it.each(['basic', 'finance', 'credit', 'house'] as const)('%s 초안 변경 시 5단계를 잠그고 주택 초안을 보존한다', (step) => {
    completePrevious()
    useDiagnosisStore.getState().completeHouse(house)
    const state = useDiagnosisStore.getState()
    if (step === 'basic') state.saveBasicDraft({ ...basic, age: '' })
    if (step === 'finance') state.saveFinanceDraft({ ...finance, cash: '' })
    if (step === 'credit') state.saveCreditDraft({ ...credit, score: '' })
    if (step === 'house') state.saveHouseDraft({ ...house, purchasePrice: '' })
    expect(useDiagnosisStore.getState().houseCompleted).toBe(false)
    expect(useDiagnosisStore.getState().house.city).toBe(house.city)
  })
  it('미완성 초안도 보존하고 초기화 시 제거한다', () => {
    const draft = { ...house, appraisal: '미완성', closingDate: '2026-12-01' }
    useDiagnosisStore.getState().saveHouseDraft(draft)
    expect(useDiagnosisStore.getState().house).toEqual(draft)
    useDiagnosisStore.setState(useDiagnosisStore.getInitialState(), true)
    expect(useDiagnosisStore.getState().house).toEqual(emptyHouse)
    expect(useDiagnosisStore.getState().houseCompleted).toBe(false)
  })
  it('변경 없는 선행 제출은 완료 상태를 보존한다', () => {
    completePrevious()
    useDiagnosisStore.getState().completeHouse(house)
    completePrevious()
    expect(useDiagnosisStore.getState().houseCompleted).toBe(true)
  })
  it.each(['basic', 'finance', 'credit'] as const)('%s 변경을 직접 제출해도 주택 완료를 해제한다', (step) => {
    completePrevious()
    useDiagnosisStore.getState().completeHouse(house)
    const state = useDiagnosisStore.getState()
    if (step === 'basic') state.completeBasic({ ...basic, age: '36' })
    if (step === 'finance') state.completeFinance({ ...finance, cash: '1' })
    if (step === 'credit') state.completeCredit({ ...credit, score: '801' })
    expect(useDiagnosisStore.getState().houseCompleted).toBe(false)
  })
  it.each(['finance', 'credit', 'house'] as const)('%s 잘못된 재제출 시 주택 완료를 해제한다', (step) => {
    completePrevious()
    useDiagnosisStore.getState().completeHouse(house)
    const state = useDiagnosisStore.getState()
    if (step === 'finance') state.completeFinance({ ...finance, cash: '' })
    if (step === 'credit') state.completeCredit({ ...credit, score: '' })
    if (step === 'house') state.completeHouse({ ...house, city: '' })
    expect(useDiagnosisStore.getState().houseCompleted).toBe(false)
  })
})
