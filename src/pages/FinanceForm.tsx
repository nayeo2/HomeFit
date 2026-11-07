import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { useDiagnosisStore } from '../store/diagnosis'
import { createFinanceSchema, financeConditions, isWholeAmount } from '../validation/finance'
import type { FinanceDraft } from '../validation/finance'

export function FinanceForm() {
  const navigate = useNavigate()
  const basic = useDiagnosisStore((state) => state.basic)
  const finance = useDiagnosisStore((state) => state.finance)
  const saveDraft = useDiagnosisStore((state) => state.saveFinanceDraft)
  const complete = useDiagnosisStore((state) => state.completeFinance)
  const conditions = financeConditions(basic)
  const { register, handleSubmit, subscribe, setValue, formState: { errors } } = useForm<FinanceDraft>({
    defaultValues: finance, resolver: zodResolver(createFinanceSchema(basic)),
  })

  useEffect(() => subscribe({
    formState: { values: true },
    callback: ({ values }) => saveDraft(values),
  }), [subscribe, saveDraft])

  const field = (name: keyof FinanceDraft, label: string, help: string, required = false, money = true) => (
    <div className="form-field" key={name}>
      <label htmlFor={name}>{label} {required ? '(필수)' : '(선택)'}</label>
      <p id={name + '-help'}>{help}</p>
      <input id={name} type="text" inputMode="numeric" required={required}
        {...register(name, { onBlur: (event) => {
          const value: string = event.target.value
          if (money && isWholeAmount(value)) {
            setValue(name, Number(value.replaceAll(',', '')).toLocaleString('ko-KR'))
          }
        } })}
        aria-invalid={!!errors[name]} aria-describedby={name + '-help ' + name + '-error'} />
      <p className="field-error" id={name + '-error'} aria-live="polite">{errors[name]?.message}</p>
    </div>
  )
  const select = (name: keyof FinanceDraft, label: string, help: string, options: [string, string][], required = false) => (
    <div className="form-field">
      <label htmlFor={name}>{label} {required ? '(필수)' : '(선택)'}</label>
      <p id={name + '-help'}>{help}</p>
      <select id={name} required={required} {...register(name)}
        aria-invalid={!!errors[name]} aria-describedby={name + '-help ' + name + '-error'}>
        <option value="">선택해 주세요</option>
        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
      <p className="field-error" id={name + '-error'} aria-live="polite">{errors[name]?.message}</p>
    </div>
  )

  return (
    <Card className="diagnosis-placeholder">
      <form className="basic-form" noValidate autoComplete="off" onSubmit={handleSubmit((values) => {
        if (complete(values)) navigate('/diagnosis/credit')
      })}>
        <p>금액은 모두 원(KRW) 단위입니다. 소득이나 자금이 없으면 0을 입력해 주세요. 선택 항목은 비워 둘 수 있습니다. 입력은 메모리에만 보관되며 새로고침하면 초기화됩니다.</p>
        <fieldset className="finance-group">
          <legend>소득 정보</legend>
          {select('employmentType', '근로·소득 유형', '현재의 주된 소득 유형을 선택해 주세요. 대출 자격을 판단하지 않습니다.', [
            ['employee', '근로소득'], ['selfEmployed', '사업소득'], ['freelancer', '프리랜서'], ['pension', '연금소득'], ['other', '기타'], ['none', '소득 없음'],
          ], true)}
          {field('annualIncome', '본인 연소득 (원)', '배우자 소득을 제외한 본인의 연간 소득을 입력해 주세요.', true)}
          {select('incomeProof', '소득 증빙 상태', '증빙 가능 여부를 선택해 주세요. 실제 인정 소득은 금융기관 확인이 필요합니다.', [
            ['available', '증빙 가능'], ['unavailable', '증빙 어려움'], ['unknown', '확인 필요'],
          ], true)}
          {field('employmentMonths', '근로·사업 기간 (개월)', '현재 근로 또는 사업을 이어온 기간을 개월로 입력해 주세요.', false, false)}
          {conditions.spouse && <>
            {field('spouseIncome', '배우자 연소득 (원)', '본인 소득과 별도로 입력해 주세요. 입력만으로 합산하지 않습니다.')}
            {select('spouseEligibility', '배우자 소득 합산 자격 확인 상태', '금융기관에서 확인한 상태가 없다면 확인 필요를 선택해 주세요. 이 선택은 자격 판정이 아닙니다.', [
              ['eligible', '합산 가능으로 확인받음'], ['ineligible', '합산 불가로 확인받음'], ['unknown', '확인 필요'],
            ])}
          </>}
        </fieldset>
        <fieldset className="finance-group">
          <legend>구입 자금과 상환 예산</legend>
          {field('cash', '보유 현금·예금 (원)', '현재 보유한 현금·예금 총액을 입력해 주세요. 아래 금융자산·매각대금·반환 보증금과 중복하지 마세요. 비상자금은 아래에 별도로 표시해 주세요.', true)}
          {field('financialAssets', '투입 가능한 금융자산 (원)', '현금·예금에 포함하지 않은 투자자산 중 구입에 사용할 수 있는 금액만 입력해 주세요.')}
          {field('emergencyReserve', '남겨 둘 비상자금 (원)', '위 자금 중 주택 구입에 사용하지 않고 남겨 둘 금액입니다. 같은 금액을 미리 차감해 중복 제외하지 마세요.')}
          {field('depositReturn', '회수 가능한 임차보증금 (원)', '반환받아 구입에 사용할 수 있는 금액만 입력해 주세요. 현금·예금과 중복하지 마세요.')}
          {conditions.sale && field('saleProceeds', '주택 매각 순유입액 (원)', '총매각가가 아닌, 매각에 따른 대출 상환·보증금 반환·비용 등을 제외하고 실제 사용할 수 있는 예상 순유입액을 입력해 주세요. 다른 자금과 중복하지 마세요.')}
          {field('monthlyBudget', '월 상환 가능 예산 (원)', '생활비 등을 고려하여 매달 무리 없이 감당할 수 있는 상환 금액을 입력해 주세요.', true)}
        </fieldset>
        <div className="form-actions">
          <Button onClick={() => navigate('/diagnosis/basic')}>이전 · 기본정보</Button>
          <Button type="submit">다음 · 부채·신용</Button>
        </div>
      </form>
    </Card>
  )
}
