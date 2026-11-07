import { z } from 'zod'
import { isWholeAmount } from './finance'

export const loanTypes = [['mortgage', '주택담보대출'], ['credit', '신용대출'], ['creditLine', '한도대출'], ['deposit', '전세대출'], ['other', '기타']] as const
export const repaymentMethods = [['equalPayment', '원리금균등상환'], ['equalPrincipal', '원금균등상환'], ['bullet', '만기일시상환'], ['other', '기타']] as const
export const emptyLoan = { type: '', balance: '', annualRate: '', remainingMonths: '', repaymentMethod: '', creditLimit: '', plannedPayoff: '' }
export type LoanDraft = typeof emptyLoan
export type CreditDraft = { hasLoans: string; bureau: string; score: string; delinquency: string; debtAdjustment: string; loans: LoanDraft[] }
export const emptyCredit: CreditDraft = { hasLoans: '', bureau: '', score: '', delinquency: '', debtAdjustment: '', loans: [] }

const loanSchema = z.object({
  type: z.string(), balance: z.string(), annualRate: z.string(), remainingMonths: z.string(),
  repaymentMethod: z.string(), creditLimit: z.string(), plannedPayoff: z.string(),
})
export const creditSchema = z.object({
  hasLoans: z.string(), bureau: z.string(), score: z.string(), delinquency: z.string(),
  debtAdjustment: z.string(), loans: z.array(loanSchema),
}).superRefine((values, ctx) => {
  const error = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message })
  for (const key of ['hasLoans', 'delinquency', 'debtAdjustment'] as const) {
    if (!['yes', 'no'].includes(values[key])) error([key], '해당 여부를 선택해 주세요.')
  }
  if (!['KCB', 'NICE'].includes(values.bureau)) error(['bureau'], '신용평가사를 선택해 주세요.')
  if (!/^\d+$/.test(values.score) || !Number.isSafeInteger(Number(values.score))) error(['score'], '신용점수를 0 이상의 정수로 입력해 주세요.')
  if (values.hasLoans !== 'yes') return
  if (!values.loans.length) error(['loans', 'root'], '기존 대출을 하나 이상 추가해 주세요.')
  values.loans.forEach((loan, index) => {
    const fail = (key: keyof LoanDraft, message: string) => error(['loans', index, key], message)
    if (!loanTypes.some(([type]) => type === loan.type)) fail('type', '대출 종류를 선택해 주세요.')
    if (!repaymentMethods.some(([method]) => method === loan.repaymentMethod)) fail('repaymentMethod', '상환 방식을 선택해 주세요.')
    if (!isWholeAmount(loan.balance)) fail('balance', '잔액을 0 이상의 정수로 원(KRW) 단위로 입력해 주세요.')
    if (!/^\d+(\.\d+)?$/.test(loan.annualRate) || !Number.isFinite(Number(loan.annualRate))) fail('annualRate', '연이율을 0 이상의 숫자로 입력해 주세요.')
    if (!/^\d+$/.test(loan.remainingMonths) || !Number.isSafeInteger(Number(loan.remainingMonths)) || Number(loan.remainingMonths) <= 0) fail('remainingMonths', '남은 기간을 1 이상의 정수로 개월 단위로 입력해 주세요.')
    if (!['yes', 'no'].includes(loan.plannedPayoff)) fail('plannedPayoff', '신규 주택담보대출 전 상환 예정 여부를 선택해 주세요.')
    if (loan.type === 'creditLine' && !isWholeAmount(loan.creditLimit)) fail('creditLimit', '대출 한도를 0 이상의 정수로 원(KRW) 단위로 입력해 주세요.')
  })
}).transform((values) => ({ ...values, loans: values.hasLoans === 'no' ? [] : values.loans.map((loan) => ({ ...loan, creditLimit: loan.type === 'creditLine' ? loan.creditLimit : '' })) }))
