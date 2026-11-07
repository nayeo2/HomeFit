import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { useDiagnosisStore } from '../store/diagnosis'
import { basicSchema } from '../validation/basic'
import type { BasicDraft } from '../validation/basic'

export function BasicForm() {
  const navigate = useNavigate()
  const basic = useDiagnosisStore((state) => state.basic)
  const saveBasicDraft = useDiagnosisStore((state) => state.saveBasicDraft)
  const completeBasic = useDiagnosisStore((state) => state.completeBasic)
  const { register, handleSubmit, subscribe, formState: { errors } } = useForm<BasicDraft>({
    defaultValues: basic,
    resolver: zodResolver(basicSchema),
    mode: 'onSubmit',
  })

  useEffect(() => {
    return subscribe({ formState: { values: true }, callback: ({ values }) => {
      saveBasicDraft({
        age: values.age ?? '',
        maritalStatus: values.maritalStatus ?? '',
        homeCount: values.homeCount ?? '',
        firstTimeBuyer: values.firstTimeBuyer ?? '',
      })
    } })

  }, [subscribe, saveBasicDraft])

  return (
    <Card className="diagnosis-placeholder">
      <form className="basic-form" noValidate autoComplete="off" onSubmit={handleSubmit((values) => {
        completeBasic(values)
        navigate('/diagnosis/finance')
      })}>
        <p>모든 항목은 필수입니다. 입력 내용은 이 페이지 세션의 메모리에만 보관되며 새로고침하면 초기화됩니다.</p>
        <div className="form-field">
          <label htmlFor="age">만 나이</label>
          <p id="age-help">현재 만 나이를 숫자로 입력해 주세요. 대출 자격을 판단하는 기준이 아닙니다.</p>
          <input id="age" type="text" inputMode="numeric" required {...register('age')}
            aria-invalid={!!errors.age} aria-describedby="age-help age-error" />
          <p className="field-error" id="age-error" aria-live="polite">{errors.age?.message}</p>
        </div>
        <div className="form-field">
          <label htmlFor="maritalStatus">혼인 상태</label>
          <p id="marital-help">현재의 혼인 상태를 선택해 주세요.</p>
          <select id="maritalStatus" required {...register('maritalStatus')}
            aria-invalid={!!errors.maritalStatus} aria-describedby="marital-help marital-error">
            <option value="">선택해 주세요</option>
            <option value="single">미혼</option>
            <option value="married">기혼</option>
            <option value="divorced">이혼</option>
            <option value="widowed">사별</option>
          </select>
          <p className="field-error" id="marital-error" aria-live="polite">{errors.maritalStatus?.message}</p>
        </div>
        <div className="form-field">
          <label htmlFor="homeCount">세대 보유 주택 수</label>
          <p id="home-help">세대가 현재 보유한 주택 수를 입력해 주세요. 무주택이면 0을 입력해 주세요.</p>
          <input id="homeCount" type="text" inputMode="numeric" required {...register('homeCount')}
            aria-invalid={!!errors.homeCount} aria-describedby="home-help home-error" />
          <p className="field-error" id="home-error" aria-live="polite">{errors.homeCount?.message}</p>
        </div>
        <div className="form-field">
          <label htmlFor="firstTimeBuyer">생애 최초 주택 구입 여부</label>
          <p id="first-home-help">본인의 주택 구입 이력을 기준으로 선택해 주세요. 금융상품의 공식 자격 판단과는 다를 수 있습니다.</p>
          <select id="firstTimeBuyer" required {...register('firstTimeBuyer')}
            aria-invalid={!!errors.firstTimeBuyer} aria-describedby="first-home-help first-home-error">
            <option value="">선택해 주세요</option>
            <option value="yes">처음 구입해요</option>
            <option value="no">이전에 구입한 적이 있어요</option>
            <option value="unknown">확인이 필요해요</option>
          </select>
          <p className="field-error" id="first-home-error" aria-live="polite">{errors.firstTimeBuyer?.message}</p>
        </div>
        <Button type="submit">다음 · 소득·자산</Button>
      </form>
    </Card>
  )
}

