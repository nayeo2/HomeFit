import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { useDiagnosisStore } from '../store/diagnosis'
import { hasFixedRatePeriod, loanConditionsSchema, loanRepaymentMethods, rateTypes } from '../validation/loan'
import type { LoanConditionsDraft } from '../validation/loan'
import { isWholeAmount } from '../validation/finance'

export function LoanForm() {
  const navigate = useNavigate()
  const loan = useDiagnosisStore((state) => state.loan)
  const saveDraft = useDiagnosisStore((state) => state.saveLoanDraft)
  const complete = useDiagnosisStore((state) => state.completeLoan)
  const { register, control, subscribe, handleSubmit, setValue, getValues, formState: { errors } } = useForm<LoanConditionsDraft>({
    defaultValues: loan, resolver: zodResolver(loanConditionsSchema),
  })
  const rateType = useWatch({ control, name: 'rateType' })
  useEffect(() => subscribe({ formState: { values: true }, callback: ({ values }) => saveDraft(values) }), [subscribe, saveDraft])
  useEffect(() => {
    if (!hasFixedRatePeriod(rateType) && getValues('fixedRateYears') !== '') setValue('fixedRateYears', '')
  }, [rateType, setValue, getValues])

  const field = (name: keyof LoanConditionsDraft, label: string, options?: readonly (readonly [string, string])[], required = true) => {
    const id = 'loan-' + name
    return <div className="form-field" key={name}>
      <label htmlFor={id}>{label} {required ? '(필수)' : '(선택)'}</label>
      {options ? <select id={id} required={required} {...register(name)} aria-invalid={!!errors[name]} aria-describedby={id + '-error'}>
        <option value="">선택해 주세요</option>
        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select> : <input id={id} type="text" inputMode={name === 'annualRate' ? 'decimal' : 'numeric'} required={required}
        {...register(name, { onBlur: (event) => {
          const value: string = event.target.value
          if (name === 'requestedAmount' && isWholeAmount(value)) setValue(name, Number(value.replaceAll(',', '')).toLocaleString('ko-KR'))
        } })} aria-invalid={!!errors[name]} aria-describedby={id + '-error'} />}
      <p className="field-error" id={id + '-error'} aria-live="polite">{errors[name]?.message}</p>
    </div>
  }
  return <Card className="diagnosis-placeholder">
    <form className="basic-form" noValidate autoComplete="off" onSubmit={handleSubmit((values) => {
      if (complete(values)) navigate('/diagnosis/result')
    })}>
      <p>희망 대출금액은 직접 입력하며 자동으로 변경하지 않습니다. 금리는 사용자가 가정한 연이율이며 실제 대출 조건이나 승인을 의미하지 않습니다. 입력은 메모리에만 보관되며 새로고침하면 초기화됩니다.</p>
      <fieldset className="finance-group">
        <legend>희망 대출조건</legend>
        {field('requestedAmount', '희망 대출금액 (원·KRW)')}
        {field('annualRate', '가정 연이율 (%)')}
        {field('termYears', '대출 기간 (년)')}
        {field('rateType', '금리 유형', rateTypes)}
        {hasFixedRatePeriod(rateType) && field('fixedRateYears', '고정금리 기간 (년)', undefined, false)}
        {field('repaymentMethod', '상환 방식', loanRepaymentMethods)}
      </fieldset>
      <div className="form-actions">
        <Button onClick={() => navigate('/diagnosis/house')}>이전 · 주택정보</Button>
        <Button type="submit">다음 · 진단 결과</Button>
      </div>
    </form>
  </Card>
}
