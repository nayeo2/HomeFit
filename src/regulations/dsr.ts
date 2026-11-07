/** No production regulatory values. Verification is supplied by a trusted caller after
 * checking an official source; metadata checks do not verify a webpage's contents.
 */
export type DsrContext = {
  asOf: string
  city?: string
  district?: string
  propertyType?: string
  homeCount?: number
  firstTimeBuyer?: boolean
  loanType?: string
  rateType?: string
  repaymentMethod?: string
}
type Conditions = { [K in Exclude<keyof DsrContext, 'asOf'>]?: readonly NonNullable<DsrContext[K]>[] }
export type DsrRule<T> = {
  id: string
  effectiveFrom: string
  effectiveTo?: string
  conditions: Conditions
  exceptions: readonly Conditions[]
  source: { authority: 'FSC' | 'FSS' | 'HF'; sourceUrl: string }
  verification: 'verified' | 'unverified'
  verifiedAt?: string
  version: string
  value: T
}
export type DebtServiceTreatment =
  | { method: 'providedAnnualAmount' }
  | { method: 'principalOverYearsPlusInterest'; principalBasis: 'balance' | 'creditLimit'; interestBasis: 'balance' | 'creditLimit'; recognizedYears: number }
  | { method: 'scheduledFirstYear' }
  | { method: 'excluded' }
export type DebtServiceRule = DsrRule<{
  kind: 'debtService'
  treatment: DebtServiceTreatment
  plannedPayoff: 'include' | 'exclude' | 'needsVerification'
  confirmedPayoff: 'include' | 'exclude' | 'needsVerification'
}>
export type DsrLimitRule = DsrRule<{ kind: 'dsrLimit'; limitPercent: number }>
export type StressDsrRule = DsrRule<{
  kind: 'stressRate'
  // Only this explicitly specified arithmetic strategy is supported.
  method: 'additive'
  marginPercentagePoints: number
  applicationFactor: number
}>
export type Unavailable = { status: 'NEEDS_VERIFICATION'; reason: string }
export type RuleSelection<R> = { status: 'AVAILABLE'; rule: R } | Unavailable
export const unavailable = (reason: string): Unavailable => ({ status: 'NEEDS_VERIFICATION', reason })

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false
  const date = new Date(value + 'T00:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
function match(conditions: Conditions, context: DsrContext): 'yes' | 'no' | 'unknown' {
  let unknown = false
  for (const key of Object.keys(conditions) as (keyof Conditions)[]) {
    const expected: readonly (string | number | boolean)[] = conditions[key]!
    if (context[key] === undefined) unknown = true
    else if (!expected.includes(context[key])) return 'no'
  }
  return unknown ? 'unknown' : 'yes'
}
function validMetadata(rule: DsrRule<unknown>) {
  let source = false
  try {
    const url = new URL(rule.source.sourceUrl)
    source = url.protocol === 'https:' && !!url.hostname && ['FSC', 'FSS', 'HF'].includes(rule.source.authority)
  } catch { /* No usable source metadata. */ }
  return !!rule.id.trim() && !!rule.version.trim() && source && validDate(rule.effectiveFrom)
    && (rule.effectiveTo === undefined || (validDate(rule.effectiveTo) && rule.effectiveTo >= rule.effectiveFrom))
    && (rule.verifiedAt === undefined || validDate(rule.verifiedAt))
}

/** Inclusive dates. Any unknown, overlapping or conflicting candidate blocks selection. */
export function selectDsrRule<R extends DsrRule<unknown>>(rules: readonly R[], context: DsrContext): RuleSelection<R> {
  if (!validDate(context.asOf)) throw new RangeError('기준일은 올바른 YYYY-MM-DD 날짜여야 합니다.')
  if (context.homeCount !== undefined && (!Number.isSafeInteger(context.homeCount) || context.homeCount < 0)) throw new RangeError('보유 주택 수는 0 이상의 정수여야 합니다.')
  const candidates: R[] = []
  let unknown = false
  for (const rule of rules) {
    if (!validMetadata(rule)) return unavailable('INVALID_RULE_METADATA')
    if (context.asOf < rule.effectiveFrom || (rule.effectiveTo !== undefined && context.asOf > rule.effectiveTo)) continue
    const base = match(rule.conditions, context)
    if (base === 'no') continue
    const exceptions = rule.exceptions.map((exception) => match(exception, context))
    if (exceptions.includes('yes')) continue
    if (base === 'unknown' || exceptions.includes('unknown')) unknown = true
    else candidates.push(rule)
  }
  if (unknown) return unavailable('UNKNOWN_APPLICABILITY')
  if (candidates.length === 0) return unavailable('NO_APPLICABLE_RULE')
  if (candidates.some((rule) => rule.verification !== 'verified' || rule.verifiedAt === undefined || rule.verifiedAt > context.asOf)) return unavailable('UNVERIFIED_RULE')
  if (candidates.length !== 1) return unavailable('AMBIGUOUS_OR_CONFLICTING_RULES')
  return { status: 'AVAILABLE', rule: candidates[0] }
}
