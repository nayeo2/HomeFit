import { describe, expect, it } from 'vitest'
import { buildDiagnosisResult } from './diagnosis'
import type { DiagnosisInputs } from './diagnosis'
import { emptyFinance } from '../validation/finance'
import { emptyHouse } from '../validation/house'
import { emptyCredit } from '../validation/credit'
import { emptyLoanConditions } from '../validation/loan'
import { calculatePurchaseFunding, calculateRepayment } from '../calculations/finance'

const inputs: DiagnosisInputs = {
  basic: { age: '35', maritalStatus: 'single', homeCount: '0', firstTimeBuyer: 'yes' },
  finance: { ...emptyFinance, employmentType: 'employee', annualIncome: '60000000', incomeProof: 'available', cash: '100,000,000', financialAssets: '20,000,000', emergencyReserve: '10,000,000', depositReturn: '30,000,000', monthlyBudget: '2000000' },
  credit: { ...emptyCredit, hasLoans: 'no', bureau: 'KCB', score: '800', delinquency: 'no', debtAdjustment: 'no' },
  house: { ...emptyHouse, city: '서울', district: '강서구', propertyType: '아파트', purchasePrice: '500,000,000', acquisitionCosts: '10,000,000', appraisal: '400,000,000' },
  loan: { ...emptyLoanConditions, requestedAmount: '300,000,000', annualRate: '4.25', termYears: '30', rateType: 'variable', repaymentMethod: 'equalPayment' },
}
const date = '2026-11-07'
describe('결과 입력 매핑과 계산 연동', () => {
  it('쉼표·선택값을 매핑하여 순수 계산 API 결과를 사용한다', () => {
    const result = buildDiagnosisResult(inputs, date)
    expect(result.status).toBe('READY')
    if (result.status !== 'READY') return
    expect(result.ownFunds).toEqual({ status: 'AVAILABLE', value: 140_000_000 })
    expect(result.funding).toEqual({ status: 'AVAILABLE', value: calculatePurchaseFunding({ cash: 100_000_000, financialAssets: 20_000_000, emergencyReserve: 10_000_000, depositReturn: 30_000_000, saleProceeds: 0, purchasePrice: 500_000_000, acquisitionCosts: 10_000_000 }) })
    expect(result.repayment).toEqual({ status: 'AVAILABLE', value: calculateRepayment({ principal: 300_000_000, annualRate: 4.25, months: 360, repaymentMethod: 'equalPayment' }) })
    expect(result.mathematicalLtv).toEqual({ status: 'AVAILABLE', value: 75 })
    expect(result.loan.requestedAmount).toBe('300,000,000')
  })
  it('미입력 비용·감정평가액을 0이나 매매가격으로 채우지 않는다', () => {
    const result = buildDiagnosisResult({ ...inputs, house: { ...inputs.house, acquisitionCosts: '', appraisal: '' } }, date)
    if (result.status !== 'READY') throw new Error('Expected ready mapping')
    expect(result.acquisitionCosts).toBeNull()
    expect(result.funding.status).toBe('NEEDS_VERIFICATION')
    expect(result.mathematicalLtv.status).toBe('NEEDS_VERIFICATION')
    expect(result.ownFunds.status).toBe('AVAILABLE')
    expect(result.repayment.status).toBe('AVAILABLE')
  })
  it('검증되지 않은 희망 대출액·소득을 규제·조달 값으로 사용하지 않는다', () => {
    const result = buildDiagnosisResult(inputs, date)
    if (result.status !== 'READY') throw new Error('Expected ready mapping')
    expect(result.fundingGap.status).toBe('NEEDS_VERIFICATION')
    expect(result.regulatoryLtv).toMatchObject({ status: 'NEEDS_VERIFICATION', code: 'NO_APPLICABLE_RULE' })
    expect(result.dsr).toMatchObject({ status: 'NEEDS_VERIFICATION', code: 'MISSING_RECOGNIZED_INCOME' })
    expect(result.stressDsr).toMatchObject({ status: 'NEEDS_VERIFICATION', code: 'NO_APPLICABLE_RULE' })
  })
  it.each(['basic', 'finance', 'credit', 'house', 'loan'] as const)('%s 필수 입력 누락을 처리한다', (key) => {
    expect(buildDiagnosisResult({ ...inputs, [key]: {} }, date)).toEqual({ status: 'INVALID_INPUT' })
  })
  it('선택 자산 공란과 조건에 해당하지 않는 매각 자금을 포함하지 않는다', () => {
    const result = buildDiagnosisResult({ ...inputs, finance: { ...inputs.finance, financialAssets: '', depositReturn: '', emergencyReserve: '', saleProceeds: '900000000', spouseIncome: '99999999' } }, date)
    if (result.status !== 'READY') throw new Error('Expected ready mapping')
    expect(result.ownFunds).toEqual({ status: 'AVAILABLE', value: 100_000_000 })
  })
  it('원금·금리·취득비용·소득 0은 유효하게 처리한다', () => {
    const result = buildDiagnosisResult({ ...inputs, finance: { ...inputs.finance, annualIncome: '0' }, house: { ...inputs.house, acquisitionCosts: '0', appraisal: '0' }, loan: { ...inputs.loan, requestedAmount: '0', annualRate: '0' } }, date)
    if (result.status !== 'READY') throw new Error('Expected ready mapping')
    expect(result.funding.status).toBe('AVAILABLE')
    expect(result.repayment).toEqual({ status: 'AVAILABLE', value: { firstPayment: 0, lastPayment: 0, totalInterest: 0, totalPayment: 0 } })
    expect(result.mathematicalLtv.status).toBe('NEEDS_VERIFICATION')
    expect(result.dsr.status).toBe('NEEDS_VERIFICATION')
  })
  it.each(['equalPayment', 'equalPrincipal', 'bullet'])('%s 상환 방식의 추정치를 연동한다', (repaymentMethod) => {
    const result = buildDiagnosisResult({ ...inputs, loan: { ...inputs.loan, requestedAmount: '120000', annualRate: '12', termYears: '1', repaymentMethod } }, date)
    if (result.status !== 'READY') throw new Error('Expected ready mapping')
    expect(result.repayment.status).toBe('AVAILABLE')
    if (repaymentMethod === 'bullet' && result.repayment.status === 'AVAILABLE') {
      expect(result.repayment.value.firstPayment).toBe(1200)
      expect(result.repayment.value.lastPayment).toBe(121200)
    }
  })
  it('계산 범위를 초과해도 화면 모델은 실패하지 않는다', () => {
    const result = buildDiagnosisResult({ ...inputs, house: { ...inputs.house, purchasePrice: String(Number.MAX_SAFE_INTEGER) }, loan: { ...inputs.loan, annualRate: '99999999999999999999' } }, date)
    if (result.status !== 'READY') throw new Error('Expected ready mapping')
    expect(result.funding.status).toBe('NEEDS_VERIFICATION')
    expect(result.repayment.status).toBe('NEEDS_VERIFICATION')
    expect(result.stressDsr.status).toBe('NEEDS_VERIFICATION')
  })
  it('연체 표시와 기존 대출 수를 보존하며 입력을 변경하지 않는다', () => {
    const credit = { ...inputs.credit, hasLoans: 'yes', delinquency: 'yes', loans: [{ type: 'credit', balance: '1000000', annualRate: '4', remainingMonths: '12', repaymentMethod: 'bullet', creditLimit: '', plannedPayoff: 'yes' }] }
    const original = { ...inputs, credit }
    const snapshot = structuredClone(original)
    const result = buildDiagnosisResult(original, date)
    if (result.status !== 'READY') throw new Error('Expected ready mapping')
    expect(result.creditRisk).toBe(true)
    expect(result.existingLoanCount).toBe(1)
    expect(result.dsr.status).toBe('NEEDS_VERIFICATION')
    expect(original).toEqual(snapshot)
  })
})
