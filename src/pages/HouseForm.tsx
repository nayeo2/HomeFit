import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { useDiagnosisStore } from '../store/diagnosis'
import { houseSchema } from '../validation/house'
import type { HouseDraft } from '../validation/house'
import { isWholeAmount } from '../validation/finance'

export function HouseForm() {
  const navigate = useNavigate()
  const house = useDiagnosisStore((state) => state.house)
  const saveDraft = useDiagnosisStore((state) => state.saveHouseDraft)
  const complete = useDiagnosisStore((state) => state.completeHouse)
  const { register, subscribe, handleSubmit, setValue, formState: { errors } } = useForm<HouseDraft>({
    defaultValues: house, resolver: zodResolver(houseSchema),
  })
  useEffect(() => subscribe({ formState: { values: true }, callback: ({ values }) => saveDraft(values) }), [subscribe, saveDraft])

  const field = (name: keyof HouseDraft, label: string, required = false, money = false, date = false) => {
    const id = 'house-' + name
    return <div className="form-field" key={name}>
      <label htmlFor={id}>{label} {required ? '(필수)' : '(선택)'}</label>
      <input id={id} type={date ? 'date' : 'text'} inputMode={money ? 'numeric' : undefined} required={required}
        {...register(name, { onBlur: (event) => {
          const value: string = event.target.value
          if (money && isWholeAmount(value)) setValue(name, Number(value.replaceAll(',', '')).toLocaleString('ko-KR'))
        } })} aria-invalid={!!errors[name]} aria-describedby={id + '-error'} />
      <p className="field-error" id={id + '-error'} aria-live="polite">{errors[name]?.message}</p>
    </div>
  }

  return <Card className="diagnosis-placeholder">
    <form className="basic-form" noValidate autoComplete="off" onSubmit={handleSubmit((values) => {
      if (complete(values)) navigate('/diagnosis/loan')
    })}>
      <p>금액은 모두 원(KRW) 단위입니다. 선택 항목은 비워 둘 수 있습니다. 입력은 메모리에만 보관되며 새로고침하면 초기화됩니다.</p>
      <fieldset className="finance-group">
        <legend>구입할 주택 정보</legend>
        {field('city', '소재지 시·도', true)}
        {field('district', '소재지 시·군·구', true)}
        {field('propertyType', '주택 유형', true)}
        {field('purchasePrice', '매매가격 (원)', true, true)}
        {field('appraisal', '감정평가액 (원)', false, true)}
        {field('closingDate', '잔금일', false, false, true)}
        {field('acquisitionCosts', '예상 취득 비용 (원)', false, true)}
      </fieldset>
      <div className="form-actions">
        <Button onClick={() => navigate('/diagnosis/credit')}>이전 · 부채·신용</Button>
        <Button type="submit">다음 · 대출조건</Button>
      </div>
    </form>
  </Card>
}
