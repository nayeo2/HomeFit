import { describe, expect, it } from 'vitest'
import { basicSchema } from './basic'
import { useDiagnosisStore } from '../store/diagnosis'

const valid = { age: '32', maritalStatus: 'single', homeCount: '0', firstTimeBuyer: 'yes' }

describe('기본정보 검증', () => {
  it('무주택 및 확인이 필요한 최초 구입 상태를 허용한다', () => {
    expect(basicSchema.safeParse(valid).success).toBe(true)
    expect(basicSchema.safeParse({ ...valid, firstTimeBuyer: 'unknown' }).success).toBe(true)
  })

  it.each(['', '-1', '0', '3.5', 'abc', '9007199254740992'])('잘못된 나이를 거부한다: %s', (age) => {
    expect(basicSchema.safeParse({ ...valid, age }).success).toBe(false)
  })

  it.each(['', '-1', '1.5', 'abc'])('잘못된 주택 수를 거부한다: %s', (homeCount) => {
    expect(basicSchema.safeParse({ ...valid, homeCount }).success).toBe(false)
  })

  it('선택하지 않은 필수 항목을 거부한다', () => {
    expect(basicSchema.safeParse({ ...valid, maritalStatus: '' }).success).toBe(false)
    expect(basicSchema.safeParse({ ...valid, firstTimeBuyer: '' }).success).toBe(false)
  })
})

describe('기본정보 메모리 저장소', () => {
  it('초안을 복원하고, 제출 이후 수정하면 완료 상태를 해제한다', () => {
    useDiagnosisStore.setState(useDiagnosisStore.getInitialState(), true)
    expect(useDiagnosisStore.getState().basicCompleted).toBe(false)
    useDiagnosisStore.getState().completeBasic(valid)
    expect(useDiagnosisStore.getState().basicCompleted).toBe(true)
    expect(useDiagnosisStore.getState().basic).toEqual(valid)
    const draft = { ...valid, age: '' }
    useDiagnosisStore.getState().saveBasicDraft(draft)
    expect(useDiagnosisStore.getState().basic).toEqual(draft)
    expect(useDiagnosisStore.getState().basicCompleted).toBe(false)
    useDiagnosisStore.setState(useDiagnosisStore.getInitialState(), true)
    expect(useDiagnosisStore.getState().basic.age).toBe('')
  })
})
