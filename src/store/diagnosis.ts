import { create } from 'zustand'
import { basicSchema } from '../validation/basic'
import type { BasicDraft } from '../validation/basic'
import { createFinanceSchema, emptyFinance, normalizeFinance } from '../validation/finance'
import type { FinanceDraft } from '../validation/finance'

type DiagnosisState = {
  basic: BasicDraft
  basicCompleted: boolean
  finance: FinanceDraft
  financeCompleted: boolean
  saveBasicDraft: (basic: BasicDraft) => void
  completeBasic: (basic: BasicDraft) => void
  saveFinanceDraft: (finance: FinanceDraft) => void
  completeFinance: (finance: FinanceDraft) => boolean
}

const basicChanged = (previous: BasicDraft, next: BasicDraft) =>
  (Object.keys(previous) as (keyof BasicDraft)[]).some((key) => previous[key] !== next[key])

export function accessibleDiagnosisStep(basicCompleted: boolean, financeCompleted: boolean) {
  return !basicCompleted ? 0 : financeCompleted ? 2 : 1
}

// Session memory only: no persistence middleware or storage.
export const useDiagnosisStore = create<DiagnosisState>((set, get) => ({
  basic: { age: '', maritalStatus: '', homeCount: '', firstTimeBuyer: '' },
  basicCompleted: false,
  finance: { ...emptyFinance },
  financeCompleted: false,
  saveBasicDraft: (basic) => set((state) => ({
    basic,
    basicCompleted: basicChanged(state.basic, basic) ? false : state.basicCompleted,
    finance: normalizeFinance(state.finance, basic),
    financeCompleted: basicChanged(state.basic, basic) ? false : state.financeCompleted,
  })),
  completeBasic: (basic) => set((state) => ({
    basic,
    basicCompleted: basicSchema.safeParse(basic).success,
    finance: normalizeFinance(state.finance, basic),
    financeCompleted: basicChanged(state.basic, basic) ? false : state.financeCompleted,
  })),
  saveFinanceDraft: (finance) => set((state) => ({
    finance: normalizeFinance(finance, state.basic), financeCompleted: false,
  })),
  completeFinance: (finance) => {
    const state = get()
    const result = createFinanceSchema(state.basic).safeParse(finance)
    if (!state.basicCompleted || !result.success) {
      set({ financeCompleted: false })
      return false
    }
    set({ finance: result.data, financeCompleted: true })
    return true
  },
}))
