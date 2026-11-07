import { z } from 'zod'
import type { BasicDraft } from './basic'

export const emptyFinance = {
  employmentType: '', annualIncome: '', incomeProof: '', employmentMonths: '',
  cash: '', financialAssets: '', emergencyReserve: '', monthlyBudget: '',
  depositReturn: '', saleProceeds: '', spouseIncome: '', spouseEligibility: '',
}
export type FinanceDraft = typeof emptyFinance

export function financeConditions(basic: BasicDraft) {
  return {
    spouse: basic.maritalStatus === 'married',
    sale: /^\d+$/.test(basic.homeCount.trim()) && Number(basic.homeCount) > 0,
  }
}

export function normalizeFinance(finance: FinanceDraft, basic: BasicDraft): FinanceDraft {
  const conditions = financeConditions(basic)
  return {
    ...finance,
    spouseIncome: conditions.spouse ? finance.spouseIncome : '',
    spouseEligibility: conditions.spouse ? finance.spouseEligibility : '',
    saleProceeds: conditions.sale ? finance.saleProceeds : '',
  }
}

export function isWholeAmount(value: string) {
  return /^(\d+|\d{1,3}(,\d{3})+)$/.test(value) && Number.isSafeInteger(Number(value.replaceAll(',', '')))
}

export function createFinanceSchema(basic: BasicDraft) {
  const conditions = financeConditions(basic)
  return z.object({
    employmentType: z.string(), annualIncome: z.string(), incomeProof: z.string(),
    employmentMonths: z.string(), cash: z.string(), financialAssets: z.string(),
    emergencyReserve: z.string(), monthlyBudget: z.string(), depositReturn: z.string(),
    saleProceeds: z.string(), spouseIncome: z.string(), spouseEligibility: z.string(),
  }).superRefine((values, context) => {
    const error = (path: keyof FinanceDraft, message: string) =>
      context.addIssue({ code: 'custom', path: [path], message })
    if (!['employee', 'selfEmployed', 'freelancer', 'pension', 'other', 'none'].includes(values.employmentType)) {
      error('employmentType', '근로·소득 유형을 선택해 주세요.')
    }
    if (!['available', 'unavailable', 'unknown'].includes(values.incomeProof)) {
      error('incomeProof', '소득 증빙 상태를 선택해 주세요.')
    }
    const required = ['annualIncome', 'cash', 'monthlyBudget'] as const
    const optional: (keyof FinanceDraft)[] = ['financialAssets', 'emergencyReserve', 'depositReturn']
    if (conditions.spouse) optional.push('spouseIncome')
    if (conditions.sale) optional.push('saleProceeds')
    for (const key of required) {
      if (!isWholeAmount(values[key])) error(key, '0 이상의 정수 금액을 원(KRW) 단위로 입력해 주세요.')
    }
    for (const key of optional) {
      if (values[key] !== '' && !isWholeAmount(values[key])) error(key, '금액은 0 이상의 정수로 입력하거나 비워 주세요.')
    }
    if (values.employmentMonths !== '' && !/^\d+$/.test(values.employmentMonths)) {
      error('employmentMonths', '기간은 0 이상의 정수로 개월 단위로 입력해 주세요.')
    }
    if (conditions.spouse && !['', 'eligible', 'ineligible', 'unknown'].includes(values.spouseEligibility)) {
      error('spouseEligibility', '합산 자격 확인 상태를 선택해 주세요.')
    }
  }).transform((values) => normalizeFinance(values, basic))
}
