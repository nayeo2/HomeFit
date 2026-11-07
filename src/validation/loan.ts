import { z } from 'zod'
import { isWholeAmount } from './finance'

export const emptyLoanConditions = { requestedAmount: '', annualRate: '', termYears: '', rateType: '', repaymentMethod: '', fixedRateYears: '' }
export type LoanConditionsDraft = typeof emptyLoanConditions
export const rateTypes = [['fixed', '고정금리'], ['variable', '변동금리'], ['mixed', '혼합금리']] as const
export const loanRepaymentMethods = [['equalPayment', '원리금균등상환'], ['equalPrincipal', '원금균등상환'], ['bullet', '만기일시상환']] as const
export const hasFixedRatePeriod = (rateType: string) => rateType === 'fixed' || rateType === 'mixed'
export function normalizeLoanConditions(loan: LoanConditionsDraft): LoanConditionsDraft {
  return { ...loan, fixedRateYears: hasFixedRatePeriod(loan.rateType) ? loan.fixedRateYears : '' }
}
const positiveYears = (value: string) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0

export const loanConditionsSchema = z.object({
  requestedAmount: z.string(), annualRate: z.string(), termYears: z.string(), rateType: z.string(),
  repaymentMethod: z.string(), fixedRateYears: z.string(),
}).superRefine((values, ctx) => {
  const error = (key: keyof LoanConditionsDraft, message: string) => ctx.addIssue({ code: 'custom', path: [key], message })
  if (!isWholeAmount(values.requestedAmount)) error('requestedAmount', '희망 대출금액을 0 이상의 정수로 원(KRW) 단위로 입력해 주세요.')
  if (!/^\d+(\.\d+)?$/.test(values.annualRate) || !Number.isFinite(Number(values.annualRate))) error('annualRate', '가정 연이율을 0 이상의 숫자로 입력해 주세요.')
  if (!positiveYears(values.termYears)) error('termYears', '대출 기간을 1 이상의 정수로 년 단위로 입력해 주세요.')
  if (!rateTypes.some(([value]) => value === values.rateType)) error('rateType', '금리 유형을 선택해 주세요.')
  if (!loanRepaymentMethods.some(([value]) => value === values.repaymentMethod)) error('repaymentMethod', '상환 방식을 선택해 주세요.')
  if (hasFixedRatePeriod(values.rateType) && values.fixedRateYears !== '') {
    if (!positiveYears(values.fixedRateYears)) error('fixedRateYears', '고정금리 기간을 1 이상의 정수로 년 단위로 입력하거나 비워 주세요.')
    else if (positiveYears(values.termYears) && Number(values.fixedRateYears) > Number(values.termYears)) error('fixedRateYears', '고정금리 기간은 전체 대출 기간 이내로 입력해 주세요.')
  }
}).transform(normalizeLoanConditions)
