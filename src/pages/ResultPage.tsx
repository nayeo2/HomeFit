import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/Card'
import { useDiagnosisStore } from '../store/diagnosis'
import { buildDiagnosisResult } from '../results/diagnosis'
import type { ResultValue } from '../results/diagnosis'
import { roundKrw } from '../calculations/finance'
import { loanRepaymentMethods, rateTypes } from '../validation/loan'
import { ScenarioComparison } from './ScenarioComparison'

const krw = (value: number) => `${roundKrw(value).toLocaleString('ko-KR')}원`
function Metric({ label, result, unit = 'money' }: { label: string; result: ResultValue<number>; unit?: 'money' | 'percent' }) {
  return <div className="result-metric"><dt>{label}</dt><dd>{result.status === 'AVAILABLE'
    ? unit === 'money' ? krw(result.value) : `${result.value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}%`
    : <><span className="verification-label">확인 필요 · NEEDS_VERIFICATION</span><p>{result.reason}</p></>}</dd></div>
}
const tabs = [['overview', '개요'], ['details', '상세'], ['simulation', '시뮬레이션'], ['cautions', '유의사항']] as const

export function ResultPage() {
  const inputs = useDiagnosisStore()
  const [tab, setTab] = useState<string>('overview')
  const [asOf] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })
  const result = buildDiagnosisResult(inputs, asOf)
  if (result.status !== 'READY') return <Card className="diagnosis-placeholder"><p>입력값을 확인할 수 없습니다. 각 입력 단계를 다시 확인해 주세요.</p><Link to="/diagnosis/basic">기본정보 수정</Link></Card>
  const totalCost: ResultValue<number> = result.funding.status === 'AVAILABLE' ? { status: 'AVAILABLE', value: result.funding.value.totalCost } : result.funding
  const fundingNeed: ResultValue<number> = result.funding.status === 'AVAILABLE' ? { status: 'AVAILABLE', value: result.funding.value.minimumFundingNeed } : result.funding
  const repaymentMetric = (key: 'firstPayment' | 'lastPayment' | 'totalInterest' | 'totalPayment'): ResultValue<number> => result.repayment.status === 'AVAILABLE' ? { status: 'AVAILABLE', value: result.repayment.value[key] } : result.repayment
  const label = (options: readonly (readonly [string, string])[], value: string) => options.find(([key]) => key === value)?.[1] ?? value
  return <div className="diagnosis-results">
    <Card><p className="verification-label">확인 필요 · NEEDS_VERIFICATION</p><h2>입력 기준의 참고용 추정 결과입니다</h2><p>확인 기준일: {asOf}. 대출 승인이나 확정 한도를 의미하지 않습니다. 규제 판단에 필요한 검증 정보가 없어 구입 가능 여부는 확정하지 않습니다.</p><p>금액은 원(KRW) 단위로 반올림해 표시합니다. 입력과 결과는 메모리에만 보관되며 새로고침하면 초기화됩니다.</p></Card>
    <div className="result-tabs" role="tablist" aria-label="결과 보기">
      {tabs.map(([key, text], index) => <button key={key} id={`tab-${key}`} role="tab" type="button" aria-selected={tab === key} aria-controls={`panel-${key}`} tabIndex={tab === key ? 0 : -1}
        onClick={() => setTab(key)} onKeyDown={(event) => {
          const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null
          if (next !== null) { event.preventDefault(); setTab(tabs[next][0]); (event.currentTarget.parentElement?.children[next] as HTMLElement)?.focus() }
        }}>{text}</button>)}
    </div>
    <section id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" hidden={tab !== 'overview'} tabIndex={0}>
      <div className="result-grid">
        <Card><h2>구입 자금</h2><dl>
          <Metric label="총 구입 비용 (추정)" result={totalCost} />
          <Metric label="사용 가능 자기자금 (입력 기준)" result={result.ownFunds} />
          <Metric label="자기자금 차감 후 필요자금" result={fundingNeed} />
          <Metric label="대출 조달 후 부족자금" result={result.fundingGap} />
        </dl><p>선택 자산·비상자금의 공란은 계산에 포함하지 않았습니다. 자금 간 중복 입력 여부와 실제 회수 가능 여부는 별도 확인이 필요합니다.</p></Card>
        <Card><h2>신규 대출 상환액 (추정)</h2><dl>
          <Metric label="첫 달 상환액" result={repaymentMetric('firstPayment')} />
          <Metric label="마지막 달 상환액" result={repaymentMetric('lastPayment')} />
          <Metric label="총 이자" result={repaymentMetric('totalInterest')} />
          <Metric label="총 상환액" result={repaymentMetric('totalPayment')} />
        </dl><p>신규 대출만의 월말 납부 추정치입니다. 입력 금리가 전체 기간에 동일하다고 가정하며, 변동·혼합금리의 실제 금리 변화와 수수료는 반영하지 않았습니다.</p></Card>
      </div>
    </section>
    <section id="panel-details" role="tabpanel" aria-labelledby="tab-details" hidden={tab !== 'details'} tabIndex={0}>
      <div className="result-grid">
        <Card><h2>주택·희망 대출 입력</h2><dl>
          <div className="result-metric"><dt>매매가격 (입력값)</dt><dd>{krw(result.purchasePrice)}</dd></div>
          <div className="result-metric"><dt>예상 취득 비용 (입력값)</dt><dd>{result.acquisitionCosts === null ? '미입력 · 0원으로 가정하지 않음' : krw(result.acquisitionCosts)}</dd></div>
          <div className="result-metric"><dt>희망 대출금액</dt><dd>{krw(Number(result.loan.requestedAmount.replaceAll(',', '')))}</dd></div>
          <div className="result-metric"><dt>가정 연이율 / 기간</dt><dd>{result.loan.annualRate}% / {result.loan.termYears}년</dd></div>
          <div className="result-metric"><dt>금리 유형 / 상환 방식</dt><dd>{label(rateTypes, result.loan.rateType)} / {label(loanRepaymentMethods, result.loan.repaymentMethod)}</dd></div>
          {result.loan.fixedRateYears && <div className="result-metric"><dt>고정금리 기간 (입력값)</dt><dd>{result.loan.fixedRateYears}년</dd></div>}
        </dl></Card>
        <Card><h2>LTV·DSR 확인 상태</h2><dl>
          <Metric label="수학적 LTV (입력 감정평가액 기준)" result={result.mathematicalLtv} unit="percent" />
          <Metric label="규제 LTV 한도" result={result.regulatoryLtv} unit="percent" />
          <Metric label="DSR" result={result.dsr} unit="percent" />
          <Metric label="스트레스 DSR" result={result.stressDsr} unit="percent" />
        </dl><p>검증된 적용 규칙·공식 출처가 등록되어 있지 않습니다. 입력한 감정평가액은 금융기관의 인정 담보가액으로 확인된 값이 아닙니다.</p></Card>
      </div>
    </section>
    <section id="panel-simulation" role="tabpanel" aria-labelledby="tab-simulation" hidden={tab !== 'simulation'} tabIndex={0}>
      <ScenarioComparison original={inputs} asOf={asOf} />
    </section>
    <section id="panel-cautions" role="tabpanel" aria-labelledby="tab-cautions" hidden={tab !== 'cautions'} tabIndex={0}>
      <Card><h2>확인이 필요한 사항</h2><ul>
        <li>취득 비용은 직접 입력한 추정값만 사용하며 세금·중개수수료 등을 자동 산정하지 않습니다.</li>
        <li>희망 대출금액은 실제 조달 가능액이 아닙니다. 규제 LTV·DSR·금융기관 심사를 별도로 확인해 주세요.</li>
        <li>기존 대출 {result.existingLoanCount}건의 상환 부담은 신규 대출 상환액에 포함되지 않았습니다. 상환 예정만으로 기존 대출을 규제 계산에서 제외하지 않습니다.</li>
        {result.creditRisk && <li>연체 또는 채무조정 이력이 입력되었습니다. 금융기관에 영향과 처리 상태를 확인해 주세요.</li>}
        <li>배우자 소득을 자동 합산하거나 입력 소득을 규제상 인정 소득으로 간주하지 않습니다.</li>
      </ul></Card>
    </section>
    <div className="form-actions"><Link className="button" to="/diagnosis/loan">이전 · 대출조건 수정</Link><Link className="button" to="/diagnosis/finance">소득·자산 수정</Link><Link className="button" to="/diagnosis/house">주택정보 수정</Link></div>
  </div>
}
