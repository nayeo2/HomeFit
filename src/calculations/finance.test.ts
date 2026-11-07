import { describe, expect, it } from 'vitest'
import { calculateFunding, calculateRepayment, calculateUsableFunds, repaymentAtMonth, roundKrw } from './finance'
import type { FundingInput, RepaymentInput, RepaymentMethod } from './finance'

const funding: FundingInput = {
  cash: 100_000_000, financialAssets: 20_000_000, saleProceeds: 50_000_000,
  depositReturn: 30_000_000, emergencyReserve: 10_000_000,
  purchasePrice: 500_000_000, acquisitionCosts: 15_000_000, usableLoanEstimate: 300_000_000,
}
const loan: RepaymentInput = { principal: 120_000, annualRate: 12, months: 12, repaymentMethod: 'equalPayment' }
const methods: RepaymentMethod[] = ['equalPayment', 'equalPrincipal', 'bullet']

describe('주택 구입 자금', () => {
  it('자기자금은 필요자금과 부족자금에서 각각 한 번만 차감한다', () => {
    const before = calculateFunding(funding)
    const after = calculateFunding({ ...funding, cash: funding.cash + 10_000_000 })
    expect(before.minimumFundingNeed - after.minimumFundingNeed).toBe(10_000_000)
    expect(before.fundingGap - after.fundingGap).toBe(10_000_000)
    expect(before.fundingGap).toBe(before.minimumFundingNeed - funding.usableLoanEstimate)
  })
  it('중복 없는 순자금·명시된 비용·대출로 자금 부족을 계산한다', () => {
    expect(calculateUsableFunds(funding)).toBe(190_000_000)
    expect(calculateFunding(funding)).toEqual({ totalCost: 515_000_000, usableFunds: 190_000_000, minimumFundingNeed: 325_000_000, fundingGap: 25_000_000 })
    expect(calculateFunding({ ...funding, usableLoanEstimate: 325_000_000 }).fundingGap).toBe(0)
    expect(calculateFunding({ ...funding, usableLoanEstimate: 400_000_000 }).fundingGap).toBe(0)
  })
  it('자기자금 충족·0 비용·0 대출·0 소득인 시나리오를 계산한다', () => {
    // Income is deliberately absent from the arithmetic API; no income division.
    expect(calculateFunding({ ...funding, cash: 600_000_000, acquisitionCosts: 0, usableLoanEstimate: 0 })).toMatchObject({ minimumFundingNeed: 0, fundingGap: 0 })
    const zero = { cash: 0, financialAssets: 0, saleProceeds: 0, depositReturn: 0, emergencyReserve: 0, purchasePrice: 0, acquisitionCosts: 0, usableLoanEstimate: 0 }
    expect(calculateFunding(zero)).toEqual({ totalCost: 0, usableFunds: 0, minimumFundingNeed: 0, fundingGap: 0 })
  })
  it('비상자금이 자산을 초과해도 문서의 차감 공식을 유지한다', () => {
    const result = calculateFunding({ ...funding, emergencyReserve: 210_000_000 })
    expect(result.usableFunds).toBe(-10_000_000)
    expect(result.minimumFundingNeed).toBe(525_000_000)
    expect(result.fundingGap).toBe(225_000_000)
  })
  it.each(Object.keys(funding) as (keyof FundingInput)[])('%s의 잘못된 입력을 거부한다', (key) => {
    for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => calculateFunding({ ...funding, [key]: value })).toThrow(RangeError)
    }
    expect(() => calculateFunding({ ...funding, [key]: undefined } as unknown as FundingInput)).toThrow(RangeError)
  })
  it('정수 연산의 안전 범위 초과를 거부하고 입력을 변경하지 않는다', () => {
    expect(() => calculateFunding({ ...funding, purchasePrice: Number.MAX_SAFE_INTEGER })).toThrow(RangeError)
    expect(() => calculateUsableFunds({ ...funding, cash: Number.MAX_SAFE_INTEGER })).toThrow(RangeError)
    const input = Object.freeze({ ...funding })
    expect(calculateFunding(input)).toEqual(calculateFunding(funding))
    expect(input).toEqual(funding)
  })
})

describe('월별 상환과 총 상환액', () => {
  it('원리금균등 공식의 알려진 값과 일정한 월 납입액을 반환한다', () => {
    const result = calculateRepayment(loan)
    expect(result.firstPayment).toBeCloseTo(10_661.854641, 5)
    expect(result.lastPayment).toBeCloseTo(result.firstPayment, 8)
    expect(result.totalInterest).toBeCloseTo(7_942.255697, 5)
    expect(repaymentAtMonth(loan, 1).interest).toBeCloseTo(1_200, 8)
  })
  it('원금균등은 원금을 균등 분할하고 잔액에 이자를 부과한다', () => {
    const input = { ...loan, repaymentMethod: 'equalPrincipal' as const }
    expect(repaymentAtMonth(input, 1)).toEqual({ principal: 10_000, interest: 1_200, payment: 11_200, remainingBalance: 110_000 })
    expect(repaymentAtMonth(input, 12)).toEqual({ principal: 10_000, interest: 100, payment: 10_100, remainingBalance: 0 })
    expect(calculateRepayment(input)).toEqual({ firstPayment: 11_200, lastPayment: 10_100, totalInterest: 7_800, totalPayment: 127_800 })
  })
  it('만기일시상환은 매월 이자와 마지막 회차 원금을 납부한다', () => {
    const input = { ...loan, repaymentMethod: 'bullet' as const }
    expect(repaymentAtMonth(input, 1)).toEqual({ principal: 0, interest: 1_200, payment: 1_200, remainingBalance: 120_000 })
    expect(repaymentAtMonth(input, 12)).toEqual({ principal: 120_000, interest: 1_200, payment: 121_200, remainingBalance: 0 })
    expect(calculateRepayment(input)).toEqual({ firstPayment: 1_200, lastPayment: 121_200, totalInterest: 14_400, totalPayment: 134_400 })
  })
  it.each(methods)('%s의 무이자·원금 0·1개월을 처리한다', (repaymentMethod) => {
    const input = { ...loan, repaymentMethod, annualRate: 0 }
    expect(calculateRepayment(input).totalInterest).toBe(0)
    expect(calculateRepayment(input).totalPayment).toBe(loan.principal)
    expect(repaymentAtMonth(input, 1).payment).toBe(repaymentMethod === 'bullet' ? 0 : 10_000)
    expect(calculateRepayment({ ...input, principal: 0 })).toEqual({ firstPayment: 0, lastPayment: 0, totalInterest: 0, totalPayment: 0 })
    expect(calculateRepayment({ ...loan, repaymentMethod, principal: 0 })).toEqual({ firstPayment: 0, lastPayment: 0, totalInterest: 0, totalPayment: 0 })
    expect(calculateRepayment({ ...loan, repaymentMethod, months: 1 })).toEqual({ firstPayment: 121_200, lastPayment: 121_200, totalInterest: 1_200, totalPayment: 121_200 })
  })
  it.each(methods)('%s 여러 원금·금리·기간에서 합계와 최종 잔액을 검증한다', (repaymentMethod) => {
    for (const principal of [1, 1_000_003, 300_000_000]) {
      for (const annualRate of [0, 0.001, 4.5]) {
        for (const months of [1, 7, 360]) {
          const input = Object.freeze({ principal, annualRate, months, repaymentMethod })
          const rows = Array.from({ length: months }, (_, i) => repaymentAtMonth(input, i + 1))
          const summary = calculateRepayment(input)
          expect(rows.reduce((sum, row) => sum + row.principal, 0)).toBeCloseTo(principal, 4)
          expect(rows.reduce((sum, row) => sum + row.interest, 0)).toBeCloseTo(summary.totalInterest, 4)
          expect(rows.reduce((sum, row) => sum + row.payment, 0)).toBeCloseTo(summary.totalPayment, 4)
          expect(rows.at(-1)?.remainingBalance).toBe(0)
          for (const row of rows) {
            expect(row.principal).toBeGreaterThanOrEqual(0)
            expect(row.interest).toBeGreaterThanOrEqual(0)
            expect(row.remainingBalance).toBeGreaterThanOrEqual(0)
          }
        }
      }
    }
  })
  it('매우 작은 금리에서도 유한한 값을 반환한다', () => {
    const input = { ...loan, annualRate: 1e-12 }
    expect(calculateRepayment(input).firstPayment).toBeCloseTo(10_000, 6)
    expect(repaymentAtMonth(input, 12).remainingBalance).toBe(0)
  })
  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('잘못된 기간 %s를 원금 0인 경우에도 거부한다', (months) => {
    expect(() => calculateRepayment({ ...loan, months, principal: 0 })).toThrow(RangeError)
    expect(() => repaymentAtMonth({ ...loan, months }, 1)).toThrow(RangeError)
  })
  it.each([-1, NaN, Infinity])('잘못된 금리 %s를 거부한다', (annualRate) => {
    expect(() => calculateRepayment({ ...loan, annualRate })).toThrow(RangeError)
  })
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('잘못된 원금 %s를 거부한다', (principal) => {
    expect(() => calculateRepayment({ ...loan, principal })).toThrow(RangeError)
  })
  it('범위 밖 회차·미지원 방식·출력 범위 초과를 거부한다', () => {
    for (const month of [0, 13, 1.5, NaN]) expect(() => repaymentAtMonth(loan, month)).toThrow(RangeError)
    expect(() => calculateRepayment({ ...loan, repaymentMethod: 'other' } as unknown as RepaymentInput)).toThrow(RangeError)
    expect(() => calculateRepayment({ ...loan, annualRate: Number.MAX_VALUE })).toThrow(RangeError)
  })
})

describe('원 단위 반올림', () => {
  it('중간 계산은 반올림하지 않고 표시 경계에서만 반올림한다', () => {
    const row = repaymentAtMonth({ ...loan, principal: 1, annualRate: 0, months: 3 }, 1)
    expect(row.principal).toBe(1 / 3)
    expect(calculateRepayment({ ...loan, principal: 1, annualRate: 0, months: 3 }).totalPayment).toBe(1)
    expect(roundKrw(1.49)).toBe(1)
    expect(roundKrw(1.5)).toBe(2)
    expect(roundKrw(-1.5)).toBe(-1)
    expect(Object.is(roundKrw(-0.1), -0)).toBe(false)
    expect(() => roundKrw(NaN)).toThrow(RangeError)
    expect(() => roundKrw(Infinity)).toThrow(RangeError)
  })
})
