import { Link } from 'react-router-dom'
import { Card } from '../components/Card'
import { Layout } from '../components/Layout'

import { diagnosisSteps } from '../diagnosisSteps'

function DiagnosisProgress({ stepIndex }: { stepIndex: number }) {
  return (
    <nav aria-label="진단 진행 단계">
      <ol className="diagnosis-progress">
        {diagnosisSteps.map((step, index) => (
          <li key={step.path}>
            <Link to={step.path} aria-current={index === stepIndex ? 'step' : undefined}>
              <span className="progress-number" aria-hidden="true">{index + 1}</span>
              {index + 1}단계 · {step.title}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function DiagnosisPage({ stepIndex }: { stepIndex: number }) {
  const step = diagnosisSteps[stepIndex]

  return (
    <Layout>
      <div className="diagnosis-page">
        <DiagnosisProgress stepIndex={stepIndex} />
        <section aria-labelledby="diagnosis-title">
          <p className="eyebrow">전체 6단계 중 {stepIndex + 1}단계</p>
          <h1 id="diagnosis-title">{step.title}</h1>
          <Card className="diagnosis-placeholder">
            <p>{stepIndex === 5 ? '진단 결과 화면을 준비하고 있어요.' : '이 단계의 입력 화면을 준비하고 있어요.'}</p>
            <p>현재는 단계별 안내 화면만 제공하며 입력이나 계산은 진행되지 않습니다.</p>
          </Card>
          <Link to="/">홈으로 돌아가기</Link>
        </section>
      </div>
    </Layout>
  )
}

