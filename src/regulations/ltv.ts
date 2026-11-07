/** Infrastructure only. No Korean regulatory values are provided here.
 * A verified flag is caller-supplied evidence metadata, not automatic source verification.
 */
export type LtvContext = {
  asOf: string
  city?: string
  district?: string
  propertyType?: string
  homeCount?: number
  firstTimeBuyer?: boolean
}
export type LtvConditions = {
  propertyTypes?: readonly string[]
  homeCounts?: readonly number[]
  firstTimeBuyer?: boolean
}
export type LtvRule = {
  id: string
  effectiveFrom: string
  effectiveTo?: string
  region: { city?: string; district?: string }
  conditions: LtvConditions
  value: { ltvLimitPercent: number }
  exceptions: readonly LtvConditions[]
  source: { authority: 'FSC' | 'FSS' | 'HF'; sourceUrl: string }
  verification: 'verified' | 'unverified'
  verifiedAt?: string
  version: string
}
export type LtvRuleResult =
  | { status: 'AVAILABLE'; rule: LtvRule; applicableLtvLimitPercent: number }
  | { status: 'NEEDS_VERIFICATION'; reason: 'NO_APPLICABLE_RULE' | 'UNKNOWN_APPLICABILITY' | 'UNVERIFIED_RULE' | 'AMBIGUOUS_RULES' | 'INVALID_RULE_METADATA' }

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false
  const date = new Date(value + 'T00:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
type Match = 'yes' | 'no' | 'unknown'
function combine(matches: Match[]): Match {
  return matches.includes('no') ? 'no' : matches.includes('unknown') ? 'unknown' : 'yes'
}
function conditionMatch(conditions: LtvConditions, context: LtvContext): Match {
  return combine([
    conditions.propertyTypes === undefined ? 'yes' : context.propertyType === undefined ? 'unknown' : conditions.propertyTypes.includes(context.propertyType) ? 'yes' : 'no',
    conditions.homeCounts === undefined ? 'yes' : context.homeCount === undefined ? 'unknown' : conditions.homeCounts.includes(context.homeCount) ? 'yes' : 'no',
    conditions.firstTimeBuyer === undefined ? 'yes' : context.firstTimeBuyer === undefined ? 'unknown' : conditions.firstTimeBuyer === context.firstTimeBuyer ? 'yes' : 'no',
  ])
}
function applicability(rule: LtvRule, context: LtvContext): Match {
  // Both endpoints are inclusive. No implicit system date or region classification.
  if (context.asOf < rule.effectiveFrom || (rule.effectiveTo !== undefined && context.asOf > rule.effectiveTo)) return 'no'
  const base = combine([
    rule.region.city === undefined ? 'yes' : context.city === undefined ? 'unknown' : rule.region.city === context.city ? 'yes' : 'no',
    rule.region.district === undefined ? 'yes' : context.district === undefined ? 'unknown' : rule.region.district === context.district ? 'yes' : 'no',
    conditionMatch(rule.conditions, context),
  ])
  if (base === 'no') return 'no'
  const exceptions = rule.exceptions.map((condition) => conditionMatch(condition, context))
  if (exceptions.includes('yes')) return 'no'
  return base === 'unknown' || exceptions.includes('unknown') ? 'unknown' : 'yes'
}
function validMetadata(rule: LtvRule) {
  let validSource = false
  try {
    const url = new URL(rule.source.sourceUrl)
    validSource = url.protocol === 'https:' && !!url.hostname && ['FSC', 'FSS', 'HF'].includes(rule.source.authority)
  } catch { /* Invalid source cannot support a rule. */ }
  return !!rule.id.trim() && !!rule.version.trim() && validSource
    && validDate(rule.effectiveFrom)
    && (rule.effectiveTo === undefined || (validDate(rule.effectiveTo) && rule.effectiveTo >= rule.effectiveFrom))
    && (rule.verifiedAt === undefined || validDate(rule.verifiedAt))
    && Number.isFinite(rule.value.ltvLimitPercent) && rule.value.ltvLimitPercent >= 0
}

/** Unknown/overlapping candidates block selection; neither priority nor min-rate is guessed.
 * Explicit exceptions exclude a rule; a separate rule must cover the exception if applicable.
 */
export function selectLtvRule(rules: readonly LtvRule[], context: LtvContext): LtvRuleResult {
  if (!validDate(context.asOf)) throw new RangeError('기준일은 올바른 YYYY-MM-DD 날짜여야 합니다.')
  if (context.homeCount !== undefined && (!Number.isSafeInteger(context.homeCount) || context.homeCount < 0)) throw new RangeError('보유 주택 수는 0 이상의 정수여야 합니다.')
  const candidates: LtvRule[] = []
  let unknown = false
  for (const rule of rules) {
    if (!validMetadata(rule)) return { status: 'NEEDS_VERIFICATION', reason: 'INVALID_RULE_METADATA' }
    const match = applicability(rule, context)
    if (match === 'unknown') unknown = true
    if (match === 'yes') candidates.push(rule)
  }
  if (unknown) return { status: 'NEEDS_VERIFICATION', reason: 'UNKNOWN_APPLICABILITY' }
  if (candidates.some((rule) => rule.verification !== 'verified' || rule.verifiedAt === undefined || rule.verifiedAt > context.asOf)) return { status: 'NEEDS_VERIFICATION', reason: 'UNVERIFIED_RULE' }
  if (candidates.length === 0) return { status: 'NEEDS_VERIFICATION', reason: 'NO_APPLICABLE_RULE' }
  if (candidates.length > 1) return { status: 'NEEDS_VERIFICATION', reason: 'AMBIGUOUS_RULES' }
  return { status: 'AVAILABLE', rule: candidates[0], applicableLtvLimitPercent: candidates[0].value.ltvLimitPercent }
}
