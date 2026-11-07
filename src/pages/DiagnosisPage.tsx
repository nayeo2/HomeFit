import { Link } from 'react-router-dom'
import { Card } from '../components/Card'
import { Layout } from '../components/Layout'
import { Navigate } from 'react-router-dom'
import { BasicForm } from './BasicForm'
import { FinanceForm } from './FinanceForm'
import { CreditForm } from './CreditForm'
import { HouseForm } from './HouseForm'
import { accessibleDiagnosisStep, useDiagnosisStore } from '../store/diagnosis'

import { diagnosisSteps } from '../diagnosisSteps'

function DiagnosisProgress({ stepIndex }: { stepIndex: number }) {
  const basicCompleted = useDiagnosisStore((state) => state.basicCompleted)
  const financeCompleted = useDiagnosisStore((state) => state.financeCompleted)
  const creditCompleted = useDiagnosisStore((state) => state.creditCompleted)
  const houseCompleted = useDiagnosisStore((state) => state.houseCompleted)
  const accessibleStep = accessibleDiagnosisStep(basicCompleted, financeCompleted, creditCompleted, houseCompleted)
  return (
    <nav aria-label="진단 진행 단계">
      <ol className="diagnosis-progress">
        {diagnosisSteps.map((step, index) => (
          <li key={step.path}>
            {index <= accessibleStep ? <Link to={step.path} aria-current={index === stepIndex ? 'step' : undefined}>
              <span className="progress-number" aria-hidden="true">{index + 1}</span>
              {index + 1}단계 · {step.title}
            </Link> : <span className="locked-step" aria-disabled="true">{index + 1}단계 · {step.title} (잠김)</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function DiagnosisPage({ stepIndex }: { stepIndex: number }) {
  const basicCompleted = useDiagnosisStore((state) => state.basicCompleted)
  const financeCompleted = useDiagnosisStore((state) => state.financeCompleted)
  const creditCompleted = useDiagnosisStore((state) => state.creditCompleted)
  const houseCompleted = useDiagnosisStore((state) => state.houseCompleted)
  const accessibleStep = accessibleDiagnosisStep(basicCompleted, financeCompleted, creditCompleted, houseCompleted)
  if (stepIndex > accessibleStep) {
    return <Navigate to={diagnosisSteps[accessibleStep].path} replace />
  }
  const step = diagnosisSteps[stepIndex]

  return (
    <Layout>
      <div className="diagnosis-page">
        <DiagnosisProgress stepIndex={stepIndex} />
        <section aria-labelledby="diagnosis-title">
          <p className="eyebrow">전체 6단계 중 {stepIndex + 1}단계</p>
          <h1 id="diagnosis-title">{step.title}</h1>
          {stepIndex === 0 ? <BasicForm /> : stepIndex === 1 ? <FinanceForm /> : stepIndex === 2 ? <CreditForm /> : stepIndex === 3 ? <HouseForm /> : <Card className="diagnosis-placeholder">
            <p>{stepIndex === 5 ? '진단 결과 화면을 준비하고 있어요.' : '이 단계의 입력 화면을 준비하고 있어요.'}</p>
            <p>현재는 단계별 안내 화면만 제공하며 입력이나 계산은 진행되지 않습니다.</p>
          </Card>}
          <Link to="/">홈으로 돌아가기</Link>
        </section>
      </div>
    </Layout>
  )
}

