import { describe, expect, it } from 'vitest'
import { calculateLtv, calculateLtvLoanLimit } from './ltv'
import type { CollateralValue } from './ltv'

const collateral: CollateralValue = { amount: 400_000_000, basis: 'appraisal' }
describe('LTV 산술 계산 (자격 판단 제외)', () => {
  it('매매가격과 다른 담보가액으로 요청금액의 비율을 계산한다', () => {
    expect(calculateLtv({ purchasePrice: 500_000_000, collateralValue: collateral, requestedLoanAmount: 200_000_000 })).toEqual({ status: 'AVAILABLE', ratioPercent: 50, basis: 'appraisal' })
    expect(calculateLtvLoanLimit(collateral, 25)).toEqual({ status: 'AVAILABLE', loanLimit: 100_000_000, basis: 'appraisal' })
  })
  it('0 요청금액과 담보가액 초과 비율을 자격 판단 없이 계산한다', () => {
    for (const [requestedLoanAmount, ratioPercent] of [[0, 0], [400_000_000, 100], [600_000_000, 150]]) {
      expect(calculateLtv({ purchasePrice: 1, collateralValue: collateral, requestedLoanAmount })).toMatchObject({ status: 'AVAILABLE', ratioPercent })
    }
    expect(calculateLtvLoanLimit(collateral, 0)).toMatchObject({ status: 'AVAILABLE', loanLimit: 0 })
    expect(calculateLtvLoanLimit(collateral, 100)).toMatchObject({ status: 'AVAILABLE', loanLimit: collateral.amount })
  })
  it('담보가액 부재·0 및 규칙 부재를 구분하고 매매가격을 대입하지 않는다', () => {
    expect(calculateLtv({ purchasePrice: 500_000_000, collateralValue: null, requestedLoanAmount: 1 })).toEqual({ status: 'NEEDS_VERIFICATION', reason: 'MISSING_COLLATERAL' })
    expect(calculateLtv({ purchasePrice: 1, collateralValue: { ...collateral, amount: 0 }, requestedLoanAmount: 0 })).toEqual({ status: 'NEEDS_VERIFICATION', reason: 'ZERO_COLLATERAL' })
    expect(calculateLtvLoanLimit(null, 25)).toMatchObject({ reason: 'MISSING_COLLATERAL' })
    expect(calculateLtvLoanLimit({ ...collateral, amount: 0 }, 25)).toMatchObject({ reason: 'ZERO_COLLATERAL' })
    expect(calculateLtvLoanLimit(collateral, null)).toEqual({ status: 'NEEDS_VERIFICATION', reason: 'MISSING_LTV_LIMIT' })
  })
  it('매매가격 대체는 호출자가 명시한 가정으로 표시하고 소수 원을 유지한다', () => {
    const assumption: CollateralValue = { amount: 3, basis: 'purchasePriceAssumption' }
    expect(calculateLtv({ purchasePrice: 3, collateralValue: assumption, requestedLoanAmount: 1 })).toMatchObject({ basis: 'purchasePriceAssumption' })
    expect(calculateLtvLoanLimit(assumption, 25)).toEqual({ status: 'AVAILABLE', loanLimit: 0.75, basis: 'purchasePriceAssumption' })
  })
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('잘못된 금액 %s를 거부한다', (amount) => {
    expect(() => calculateLtv({ purchasePrice: amount, collateralValue: collateral, requestedLoanAmount: 0 })).toThrow(RangeError)
    expect(() => calculateLtv({ purchasePrice: 0, collateralValue: collateral, requestedLoanAmount: amount })).toThrow(RangeError)
    expect(() => calculateLtvLoanLimit({ ...collateral, amount }, 25)).toThrow(RangeError)
  })
  it('잘못된 한도율과 결과 범위 초과를 거부한다', () => {
    for (const value of [-1, NaN, Infinity, Number.MAX_VALUE]) expect(() => calculateLtvLoanLimit(collateral, value)).toThrow(RangeError)
  })
})
