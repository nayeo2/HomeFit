import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { buildScenarioComparison, createScenarioDraft, createScenarioSchema } from '../results/scenario'
import type { ScenarioDraft, ComparisonRow } from '../results/scenario'
import type { DiagnosisInputs, ResultValue } from '../results/diagnosis'
import { isWholeAmount } from '../validation/finance'
import { roundKrw } from '../calculations/finance'

function format(value: number, unit: ComparisonRow['unit'], difference = false) {
  const rounded = unit === 'money' ? roundKrw(value) : value
  return (difference && rounded > 0 ? '+' : '') + rounded.toLocaleString('ko-KR', { maximumFractionDigits: unit === 'money' ? 0 : 4 }) + (unit === 'money' ? '원' : unit === 'years' ? '년' : difference ? '%p' : '%')
}
function Value({ result, unit, difference = false }: { result: ResultValue<number>; unit: ComparisonRow['unit']; difference?: boolean }) {
  return result.status === 'AVAILABLE' ? <>{format(result.value, unit, difference)}</> : <><span className="verification-label">NEEDS_VERIFICATION · 확인 필요</span><p>{result.reason}</p></>
}
const fields = [['purchasePrice', '시뮬레이션 매매가격 (원·KRW)'], ['requestedAmount', '시뮬레이션 희망 대출금액 (원·KRW)'], ['annualRate', '시뮬레이션 가정 연이율 (%)'], ['termYears', '시뮬레이션 대출 기간 (년)']] as const

export function ScenarioComparison({ original, asOf }: { original: DiagnosisInputs; asOf: string }) {
  const defaults = createScenarioDraft(original)
  const { register, control, reset, setValue, handleSubmit } = useForm<ScenarioDraft>({ defaultValues: defaults, resolver: zodResolver(createScenarioSchema(original)), mode: 'onChange' })
  const watched = useWatch({ control })
  const draft: ScenarioDraft = { purchasePrice: watched.purchasePrice ?? defaults.purchasePrice, requestedAmount: watched.requestedAmount ?? defaults.requestedAmount, annualRate: watched.annualRate ?? defaults.annualRate, termYears: watched.termYears ?? defaults.termYears }
  const comparison = buildScenarioComparison(original, draft, asOf)
  return <div className="scenario-comparison">
    <Card><h2>대출 시나리오 비교</h2><p>조정값은 원본 진단에 저장되지 않으며 입력할 때마다 비교가 갱신됩니다. 원본으로 초기화하면 네 항목을 모두 되돌립니다.</p>
      <form className="basic-form" noValidate autoComplete="off" onSubmit={handleSubmit(() => {})}>
        <div className="result-grid">{fields.map(([name, label]) => {
          const error = comparison.status === 'INVALID_INPUT' ? comparison.issues.find((issue) => issue.path[0] === name)?.message : undefined
          return <div className="form-field" key={name}><label htmlFor={`scenario-${name}`}>{label}</label>
            <input id={`scenario-${name}`} type="text" required inputMode={name === 'annualRate' ? 'decimal' : 'numeric'} {...register(name, { onBlur: (event) => {
              const value: string = event.target.value
              if ((name === 'purchasePrice' || name === 'requestedAmount') && isWholeAmount(value)) setValue(name, Number(value.replaceAll(',', '')).toLocaleString('ko-KR'))
            } })} aria-invalid={!!error} aria-describedby={`scenario-${name}-error`} />
            <p className="field-error" id={`scenario-${name}-error`} aria-live="polite">{error}</p></div>
        })}</div>
        <Button onClick={() => reset(createScenarioDraft(original))}>원본으로 초기화</Button>
      </form>
      <p>차이는 시뮬레이션 − 원본입니다. 원 단위로 반올림하며 미세한 차이는 표시되지 않을 수 있습니다. 금리 차이는 %p입니다.</p>
      <p>자기자금·취득 비용·감정평가액·상환 방식·금리 유형·고정금리 기간은 원본 입력 그대로입니다. 주택가격 변경에 따른 비용·감정가 변화를 추정하지 않습니다. 전체 기간에 입력 금리가 유지된다고 가정합니다.</p>
      <p>희망 대출금액은 승인·조달 가능액이 아닙니다. 부족자금·규제 LTV·DSR·스트레스 DSR은 필요한 검증 정보가 없으면 계속 확인 필요로 표시합니다.</p>
    </Card>
    {comparison.status === 'READY' ? <div className="scenario-table-wrap"><table className="scenario-table">
      <caption>원본 진단과 시뮬레이션 비교 · 금액 단위 원(KRW)</caption>
      <thead><tr><th scope="col">항목</th><th scope="col">원본 진단</th><th scope="col">시뮬레이션</th><th scope="col">차이 (시뮬레이션 − 원본)</th></tr></thead>
      <tbody>{comparison.rows.map((row) => <tr key={row.key}><th scope="row">{row.label}</th><td><Value result={row.original} unit={row.unit} /></td><td><Value result={row.simulated} unit={row.unit} /></td><td><Value result={row.difference} unit={row.unit} difference /></td></tr>)}</tbody>
    </table></div> : <Card><p role="status">입력값을 확인해 주세요. 유효하지 않은 입력으로 비교 결과를 표시하지 않습니다.</p></Card>}
  </div>
}
