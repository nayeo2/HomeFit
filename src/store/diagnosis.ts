import { create } from 'zustand'
import { basicSchema } from '../validation/basic'
import type { BasicDraft } from '../validation/basic'
import { createFinanceSchema, emptyFinance, normalizeFinance } from '../validation/finance'
import type { FinanceDraft } from '../validation/finance'
import { creditSchema, emptyCredit } from '../validation/credit'
import type { CreditDraft } from '../validation/credit'
import { emptyHouse, houseSchema } from '../validation/house'
import type { HouseDraft } from '../validation/house'

type DiagnosisState = {
  basic: BasicDraft
  basicCompleted: boolean
  finance: FinanceDraft
  financeCompleted: boolean
  credit: CreditDraft
  creditCompleted: boolean
  house: HouseDraft
  houseCompleted: boolean
  saveHouseDraft: (house: HouseDraft) => void
  completeHouse: (house: HouseDraft) => boolean
  saveCreditDraft: (credit: CreditDraft) => void
  completeCredit: (credit: CreditDraft) => boolean
  saveBasicDraft: (basic: BasicDraft) => void
  completeBasic: (basic: BasicDraft) => void
  saveFinanceDraft: (finance: FinanceDraft) => void
  completeFinance: (finance: FinanceDraft) => boolean
}

const basicChanged = (previous: BasicDraft, next: BasicDraft) =>
  (Object.keys(previous) as (keyof BasicDraft)[]).some((key) => previous[key] !== next[key])

export function accessibleDiagnosisStep(basicCompleted: boolean, financeCompleted: boolean, creditCompleted = false, houseCompleted = false) {
  return !basicCompleted ? 0 : !financeCompleted ? 1 : !creditCompleted ? 2 : houseCompleted ? 4 : 3
}

// Session memory only: no persistence middleware or storage.
export const useDiagnosisStore = create<DiagnosisState>((set, get) => ({
  basic: { age: '', maritalStatus: '', homeCount: '', firstTimeBuyer: '' },
  basicCompleted: false,
  finance: { ...emptyFinance },
  financeCompleted: false,
  credit: { ...emptyCredit, loans: [] },
  creditCompleted: false,
  house: { ...emptyHouse },
  houseCompleted: false,
  saveHouseDraft: (house) => set({ house, houseCompleted: false }),
  completeHouse: (house) => {
    const state = get()
    const result = houseSchema.safeParse(house)
    if (!state.basicCompleted || !state.financeCompleted || !state.creditCompleted || !result.success) {
      set({ houseCompleted: false })
      return false
    }
    set({ house: result.data, houseCompleted: true })
    return true
  },
  saveCreditDraft: (credit) => set({ credit, creditCompleted: false, houseCompleted: false }),
  completeCredit: (credit) => {
    const state = get()
    const result = creditSchema.safeParse(credit)
    if (!state.basicCompleted || !state.financeCompleted || !result.success) {
      set({ creditCompleted: false, houseCompleted: false })
      return false
    }
    const changed = JSON.stringify(state.credit) !== JSON.stringify(result.data)
    set({ credit: result.data, creditCompleted: true, houseCompleted: changed ? false : state.houseCompleted })
    return true
  },
  saveBasicDraft: (basic) => set((state) => ({
    basic,
    basicCompleted: basicChanged(state.basic, basic) ? false : state.basicCompleted,
    houseCompleted: basicChanged(state.basic, basic) ? false : state.houseCompleted,
    creditCompleted: basicChanged(state.basic, basic) ? false : state.creditCompleted,
    finance: normalizeFinance(state.finance, basic),
    financeCompleted: basicChanged(state.basic, basic) ? false : state.financeCompleted,
  })),
  completeBasic: (basic) => set((state) => ({
    basic,
    basicCompleted: basicSchema.safeParse(basic).success,
    houseCompleted: basicChanged(state.basic, basic) ? false : state.houseCompleted,
    creditCompleted: basicChanged(state.basic, basic) ? false : state.creditCompleted,
    finance: normalizeFinance(state.finance, basic),
    financeCompleted: basicChanged(state.basic, basic) ? false : state.financeCompleted,
  })),
  saveFinanceDraft: (finance) => set((state) => ({
    finance: normalizeFinance(finance, state.basic), financeCompleted: false, creditCompleted: false, houseCompleted: false,
  })),
  completeFinance: (finance) => {
    const state = get()
    const result = createFinanceSchema(state.basic).safeParse(finance)
    if (!state.basicCompleted || !result.success) {
      set({ financeCompleted: false, creditCompleted: false, houseCompleted: false })
      return false
    }
    const changed = (Object.keys(result.data) as (keyof FinanceDraft)[]).some((key) => state.finance[key] !== result.data[key])
    set({ finance: result.data, financeCompleted: true, creditCompleted: changed ? false : state.creditCompleted, houseCompleted: changed ? false : state.houseCompleted })
    return true
  },
}))
