import { z } from 'zod'

export const basicSchema = z.object({
  age: z.string().trim().refine(
    (value) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0,
    '나이는 1 이상의 정수로 입력해 주세요.',
  ),
  maritalStatus: z.string().refine((value) => ['single', 'married', 'divorced', 'widowed'].includes(value), '혼인 상태를 선택해 주세요.'),
  homeCount: z.string().trim().refine(
    (value) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)),
    '세대 보유 주택 수는 0 이상의 정수로 입력해 주세요.',
  ),
  firstTimeBuyer: z.string().refine((value) => ['yes', 'no', 'unknown'].includes(value), '생애 최초 주택 구입 여부를 선택해 주세요.'),
})

export type BasicDraft = {
  age: string
  maritalStatus: string
  homeCount: string
  firstTimeBuyer: string
}

