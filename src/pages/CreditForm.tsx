import { useEffect } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import type { FieldPath } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { useDiagnosisStore } from '../store/diagnosis'
import { creditSchema, emptyLoan, loanTypes, repaymentMethods } from '../validation/credit'
import type { CreditDraft } from '../validation/credit'
import { isWholeAmount } from '../validation/finance'

const yesNo = [['yes', '있음'], ['no', '없음']] as const

export function CreditForm() {
  const navigate = useNavigate()
  const credit = useDiagnosisStore((state) => state.credit)
  const saveDraft = useDiagnosisStore((state) => state.saveCreditDraft)
  const complete = useDiagnosisStore((state) => state.completeCredit)
  const { register, control, subscribe, handleSubmit, setValue, getFieldState, formState } = useForm<CreditDraft>({
    defaultValues: credit, resolver: zodResolver(creditSchema),
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'loans' })
  const values = useWatch({ control })
  useEffect(() => subscribe({ formState: { values: true }, callback: ({ values }) => saveDraft(values) }), [subscribe, saveDraft])

  const field = (name: FieldPath<CreditDraft>, label: string, options?: readonly (readonly [string, string])[], money = false, decimal = false) => {
    const error = getFieldState(name, formState).error
    const id = 'credit-' + name.replaceAll('.', '-')
    return <div className="form-field" key={name}>
      <label htmlFor={id}>{label} (필수)</label>
      {options ? <select id={id} required {...register(name)} aria-invalid={!!error} aria-describedby={id + '-error'}>
        <option value="">선택해 주세요</option>
        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select> : <input id={id} type="text" inputMode={decimal ? 'decimal' : 'numeric'} required
        {...register(name, { onBlur: (event) => {
          const value: string = event.target.value
          if (money && isWholeAmount(value)) setValue(name, Number(value.replaceAll(',', '')).toLocaleString('ko-KR'))
        } })} aria-invalid={!!error} aria-describedby={id + '-error'} />}
      <p className="field-error" id={id + '-error'} aria-live="polite">{error?.message}</p>
    </div>
  }

  return <Card className="diagnosis-placeholder">
    <form className="basic-form" noValidate autoComplete="off" onSubmit={handleSubmit((draft) => {
      if (complete(draft)) navigate('/diagnosis/house')
    })}>
      <p>입력은 메모리에만 보관되며 새로고침하면 초기화됩니다. 신용 정보는 대출 승인 판단이 아니며 실제 심사는 금융기관 확인이 필요합니다.</p>
      <fieldset className="finance-group">
        <legend>신용 정보</legend>
        {field('bureau', '신용평가사', [['KCB', 'KCB'], ['NICE', 'NICE']])}
        {field('score', '신용점수 (점)')}
        {field('delinquency', '연체 여부', yesNo)}
        {field('debtAdjustment', '채무조정 여부', yesNo)}
      </fieldset>
      <fieldset className="finance-group">
        <legend>기존 대출</legend>
        {field('hasLoans', '기존 대출 여부', yesNo)}
        {values.hasLoans === 'no' && <p>기존 대출 없이 다음 단계로 진행합니다. 작성 중인 대출은 이 화면에서 다시 선택하면 복원되며, 다음 단계 제출 시 제외됩니다.</p>}
        {values.hasLoans === 'yes' && <>
          <p>잔액·한도는 원(KRW), 연이율은 %, 남은 기간은 개월 단위로 입력해 주세요. 상환 예정 대출도 포함해 주세요.</p>
          {fields.map((item, index) => <fieldset className="finance-group" key={item.id}>
            <legend>기존 대출 {index + 1}</legend>
            {field(`loans.${index}.type`, '대출 종류', loanTypes)}
            {field(`loans.${index}.balance`, '대출 잔액 (원)', undefined, true)}
            {field(`loans.${index}.annualRate`, '연이율 (%)', undefined, false, true)}
            {field(`loans.${index}.remainingMonths`, '남은 기간 (개월)')}
            {field(`loans.${index}.repaymentMethod`, '상환 방식', repaymentMethods)}
            {values.loans?.[index]?.type === 'creditLine' && field(`loans.${index}.creditLimit`, '대출 한도 (원)', undefined, true)}
            {field(`loans.${index}.plannedPayoff`, '신규 주택담보대출 전 전액 상환 예정', [['yes', '상환 예정'], ['no', '상환 예정 없음']])}
            <Button onClick={() => remove(index)} aria-label={`기존 대출 ${index + 1} 삭제`}>이 대출 삭제</Button>
          </fieldset>)}
          <p className="field-error" role="alert">{formState.errors.loans?.root?.message}</p>
          <Button onClick={() => append({ ...emptyLoan })}>대출 추가</Button>
        </>}
      </fieldset>
      <div className="form-actions">
        <Button onClick={() => navigate('/diagnosis/finance')}>이전 · 소득·자산</Button>
        <Button type="submit">다음 · 주택정보</Button>
      </div>
    </form>
  </Card>
}
