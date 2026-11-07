import { z } from 'zod'
import { isWholeAmount } from './finance'

export const emptyHouse = { city: '', district: '', propertyType: '', purchasePrice: '', appraisal: '', closingDate: '', acquisitionCosts: '' }
export type HouseDraft = typeof emptyHouse

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false
  const date = new Date(value + 'T00:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export const houseSchema = z.object({
  city: z.string().trim().min(1, '시·도를 입력해 주세요.'),
  district: z.string().trim().min(1, '시·군·구를 입력해 주세요.'),
  propertyType: z.string().trim().min(1, '주택 유형을 입력해 주세요.'),
  purchasePrice: z.string(), appraisal: z.string(), closingDate: z.string(), acquisitionCosts: z.string(),
}).superRefine((values, ctx) => {
  for (const key of ['purchasePrice', 'appraisal', 'acquisitionCosts'] as const) {
    if (key !== 'purchasePrice' && values[key] === '') continue
    if (!isWholeAmount(values[key])) ctx.addIssue({ code: 'custom', path: [key], message: '금액은 0 이상의 정수로 원(KRW) 단위로 입력해 주세요.' })
  }
  if (values.closingDate !== '' && !isDate(values.closingDate)) {
    ctx.addIssue({ code: 'custom', path: ['closingDate'], message: '잔금일을 올바른 날짜(YYYY-MM-DD)로 입력해 주세요.' })
  }
})
