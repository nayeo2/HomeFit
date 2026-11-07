import { describe, expect, it } from 'vitest'
import { selectDsrRule } from './dsr'
import type { DsrLimitRule } from './dsr'

// Synthetic fixture only; not an official source or current regulation.
const rule: DsrLimitRule = {
  id: 'fixture', effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31', conditions: { city: ['테스트시'] }, exceptions: [],
  source: { authority: 'HF', sourceUrl: 'https://example.invalid/test-only' }, verification: 'verified', verifiedAt: '2026-01-01', version: 'test',
  value: { kind: 'dsrLimit', limitPercent: 25 },
}
describe('DSR 규칙 메타데이터·적용 조건', () => {
  it('기준일 양 끝을 포함하고 시행 전·만료 후에는 적용하지 않는다', () => {
    for (const asOf of ['2026-01-01', '2026-12-31']) expect(selectDsrRule([rule], { asOf, city: '테스트시' }).status).toBe('AVAILABLE')
    for (const asOf of ['2025-12-31', '2027-01-01']) expect(selectDsrRule([rule], { asOf, city: '테스트시' })).toMatchObject({ reason: 'NO_APPLICABLE_RULE' })
  })
  it('확인 안 된 조건과 예외를 추정하지 않는다', () => {
    expect(selectDsrRule([rule], { asOf: '2026-06-01' })).toMatchObject({ reason: 'UNKNOWN_APPLICABILITY' })
    const exception = { ...rule, exceptions: [{ loanType: ['test'] }] }
    expect(selectDsrRule([exception], { asOf: '2026-06-01', city: '테스트시' })).toMatchObject({ reason: 'UNKNOWN_APPLICABILITY' })
    expect(selectDsrRule([exception], { asOf: '2026-06-01', city: '테스트시', loanType: 'test' })).toMatchObject({ reason: 'NO_APPLICABLE_RULE' })
  })
  it('출처·버전·유효 날짜와 검증일을 요구한다', () => {
    const context = { asOf: '2026-06-01', city: '테스트시' }
    for (const candidate of [{ ...rule, version: '' }, { ...rule, effectiveFrom: '2026-02-30' }, { ...rule, effectiveTo: '2025-01-01' }, { ...rule, source: { ...rule.source, sourceUrl: '' } }]) {
      expect(selectDsrRule([candidate], context)).toMatchObject({ reason: 'INVALID_RULE_METADATA' })
    }
    for (const verifiedAt of [undefined, '2026-07-01']) expect(selectDsrRule([{ ...rule, verifiedAt }], context)).toMatchObject({ reason: 'UNVERIFIED_RULE' })
    expect(() => selectDsrRule([], { asOf: 'invalid' })).toThrow(RangeError)
  })
  it('주택·소유·생애최초 조건도 명시적으로 일치해야 한다', () => {
    const scoped = { ...rule, conditions: { propertyType: ['테스트주택'], homeCount: [0], firstTimeBuyer: [true] } }
    const context = { asOf: '2026-06-01', propertyType: '테스트주택', homeCount: 0, firstTimeBuyer: true }
    expect(selectDsrRule([scoped], context).status).toBe('AVAILABLE')
    expect(selectDsrRule([scoped], { ...context, homeCount: undefined })).toMatchObject({ reason: 'UNKNOWN_APPLICABILITY' })
    expect(selectDsrRule([scoped], { ...context, firstTimeBuyer: false })).toMatchObject({ reason: 'NO_APPLICABLE_RULE' })
    expect(() => selectDsrRule([], { ...context, homeCount: -1 })).toThrow(RangeError)
  })
})
