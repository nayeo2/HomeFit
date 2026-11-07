import { describe, expect, it } from 'vitest'
import { selectLtvRule } from './ltv'
import type { LtvContext, LtvRule } from './ltv'
import { calculateLtvLoanLimit } from '../calculations/ltv'

// Entirely fictional fixtures, NOT Korean regulatory values or verified sources.
const rule: LtvRule = {
  id: 'test-only', effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31',
  region: { city: '테스트시', district: '테스트구' },
  conditions: { propertyTypes: ['테스트주택'], homeCounts: [0], firstTimeBuyer: true },
  value: { ltvLimitPercent: 25 }, exceptions: [],
  source: { authority: 'FSC', sourceUrl: 'https://example.invalid/fictional-test-only' },
  verification: 'verified', verifiedAt: '2026-01-01', version: 'test-v1',
}
const context: LtvContext = { asOf: '2026-06-01', city: '테스트시', district: '테스트구', propertyType: '테스트주택', homeCount: 0, firstTimeBuyer: true }
describe('LTV 규칙 선택 기반 구조', () => {
  it('검증 메타데이터와 조건이 일치하는 단일 규칙을 반환한다', () => {
    const result = selectLtvRule([rule], context)
    expect(result).toEqual({ status: 'AVAILABLE', rule, applicableLtvLimitPercent: 25 })
    if (result.status === 'AVAILABLE') {
      expect(calculateLtvLoanLimit({ amount: 1_000, basis: 'appraisal' }, result.applicableLtvLimitPercent)).toMatchObject({ loanLimit: 250 })
    }
  })
  it('규칙이 없거나 검증되지 않으면 판단 불가를 반환한다', () => {
    expect(selectLtvRule([], context)).toEqual({ status: 'NEEDS_VERIFICATION', reason: 'NO_APPLICABLE_RULE' })
    for (const candidate of [{ ...rule, verification: 'unverified' as const }, { ...rule, verifiedAt: undefined }, { ...rule, verifiedAt: '2026-07-01' }]) {
      expect(selectLtvRule([candidate], context)).toEqual({ status: 'NEEDS_VERIFICATION', reason: 'UNVERIFIED_RULE' })
    }
  })
  it.each([
    { city: '다른시' }, { district: '다른구' }, { propertyType: '다른유형' }, { homeCount: 1 }, { firstTimeBuyer: false },
    { asOf: '2025-12-31' }, { asOf: '2027-01-01' },
  ])('미적용 조건 %j를 구분한다', (change) => {
    expect(selectLtvRule([rule], { ...context, ...change })).toEqual({ status: 'NEEDS_VERIFICATION', reason: 'NO_APPLICABLE_RULE' })
  })
  it('시행일과 종료일을 포함하고 종료일 없는 규칙을 지원한다', () => {
    for (const asOf of ['2026-01-01', '2026-12-31']) expect(selectLtvRule([rule], { ...context, asOf }).status).toBe('AVAILABLE')
    expect(selectLtvRule([{ ...rule, effectiveTo: undefined }], { ...context, asOf: '2027-01-01' }).status).toBe('AVAILABLE')
  })
  it('필요한 조건이 없으면 규칙 적용을 추정하지 않는다', () => {
    for (const key of ['city', 'district', 'propertyType', 'homeCount', 'firstTimeBuyer'] as const) {
      expect(selectLtvRule([rule], { ...context, [key]: undefined })).toEqual({ status: 'NEEDS_VERIFICATION', reason: 'UNKNOWN_APPLICABILITY' })
    }
    const general = { ...rule, id: 'general', region: {}, conditions: {} }
    expect(selectLtvRule([general, rule], { ...context, homeCount: undefined })).toMatchObject({ reason: 'UNKNOWN_APPLICABILITY' })
  })
  it('예외에 해당하면 제외하고 미확인 예외는 판단을 보류한다', () => {
    const candidate = { ...rule, conditions: {}, exceptions: [{ homeCounts: [0] }] }
    expect(selectLtvRule([candidate], context)).toMatchObject({ reason: 'NO_APPLICABLE_RULE' })
    expect(selectLtvRule([candidate], { ...context, homeCount: 1 }).status).toBe('AVAILABLE')
    expect(selectLtvRule([candidate], { ...context, homeCount: undefined })).toMatchObject({ reason: 'UNKNOWN_APPLICABILITY' })
  })
  it('겹치는 규칙의 우선순위·최소 한도율을 임의 선택하지 않는다', () => {
    expect(selectLtvRule([rule, { ...rule, id: 'other', version: 'test-v2', value: { ltvLimitPercent: 10 } }], context)).toMatchObject({ reason: 'AMBIGUOUS_RULES' })
    expect(selectLtvRule([rule, { ...rule, id: 'unverified', verification: 'unverified' }], context)).toMatchObject({ reason: 'UNVERIFIED_RULE' })
  })
  it('유효하지 않은 출처·날짜·한도율·버전을 거부한다', () => {
    for (const candidate of [
      { ...rule, source: { ...rule.source, sourceUrl: '' } }, { ...rule, effectiveFrom: '2026-02-30' },
      { ...rule, effectiveTo: '2025-12-31' }, { ...rule, verifiedAt: 'invalid' },
      { ...rule, version: '' }, { ...rule, id: '' }, { ...rule, value: { ltvLimitPercent: NaN } },
    ]) expect(selectLtvRule([candidate], context)).toMatchObject({ reason: 'INVALID_RULE_METADATA' })
    expect(() => selectLtvRule([], { ...context, asOf: '2026-02-30' })).toThrow(RangeError)
    expect(() => selectLtvRule([], { ...context, homeCount: -1 })).toThrow(RangeError)
  })
})
