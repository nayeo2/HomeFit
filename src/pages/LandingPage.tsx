import { Link } from 'react-router-dom'
import { Card } from '../components/Card'
import { Layout } from '../components/Layout'

const features = [
  {
    title: '구입 자금 분석',
    description: '주택 가격과 보유 자금을 바탕으로 필요한 자금과 부족액을 살펴봐요.',
    label: '자금 계획',
  },
  {
    title: '대출 규제 확인',
    description: '공식 출처로 검증된 규칙이 있을 때 LTV·DSR 관련 조건을 살펴봐요. 확인이 필요한 조건은 별도로 안내해요.',
    label: '조건 확인',
  },
  {
    title: '월 상환액 예상',
    description: '대출 금액과 금리, 기간에 따른 예상 상환액을 통해 매달 감당할 부담을 살펴봐요.',
    label: '상환 계획',
  },
]

const steps = [
  { title: '내 상황 입력', description: '기본정보부터 소득·자산, 부채·신용, 주택정보, 대출조건까지 5단계로 입력해요.' },
  { title: '진단 결과 확인', description: '구입 자금과 예상 상환 부담, 확인이 필요한 조건을 함께 살펴봐요.' },
  { title: '조건을 바꿔 비교', description: '주택 가격이나 대출 조건을 바꾸며 나에게 맞는 계획을 찾아봐요.' },
]

function LandingPage() {
  return (
    <Layout>
      <div className="landing">
        <section className="landing-hero" aria-labelledby="welcome-title">
          <p className="eyebrow">내 집 마련의 시작, HomeFit</p>
          <h1 id="welcome-title">내 집 마련 가능성,<br />내 상황에 맞춰 살펴보세요</h1>
          <p className="intro">보유 자금부터 대출 조건, 매달 상환 부담까지.<br />주택 구입을 준비하는 데 필요한 정보를 한곳에서 살펴보는 사전진단 서비스입니다.</p>
          <Link className="button" to="/diagnosis/basic" aria-describedby="diagnosis-status">내 집 마련 진단 시작하기</Link>
          <p id="diagnosis-status" className="availability-note">5단계 입력 후 참고용 결과와 시뮬레이션을 확인할 수 있습니다. 검증 정보가 없는 규제 항목은 확인 필요로 표시합니다.</p>
          <p className="privacy-note">회원가입 없이 이용하는 HomeFit. 개인 금융정보는 브라우저 메모리에서만 처리하며 저장하거나 서버로 전송하지 않습니다.</p>
        </section>

        <section aria-labelledby="features-title">
          <div className="section-heading">
            <p className="eyebrow">미리 살펴볼 세 가지</p>
            <h2 id="features-title">내 집 마련, 숫자로 차근차근</h2>
            <p>HomeFit의 주요 기능을 소개합니다.</p>
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <Card key={feature.title}>
                <p className="feature-label">{feature.label}</p>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="how-it-works-title">
          <div className="section-heading">
            <p className="eyebrow">이용 방법</p>
            <h2 id="how-it-works-title">입력부터 비교까지, 세 번의 흐름</h2>
          </div>
          <ol className="steps">
            {steps.map((step, index) => (
              <li key={step.title}>
                <span className="step-number" aria-hidden="true">0{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <aside className="landing-disclaimer" aria-labelledby="disclaimer-title">
          <h2 id="disclaimer-title">진단 결과는 참고용 예상치입니다</h2>
          <p>실제 금융기관의 대출 승인이나 대출 가능금액을 보장하지 않습니다. 적용 규정과 상품 조건에 따라 결과가 달라질 수 있으며, 확인되지 않은 규제 조건은 추가 확인이 필요합니다.</p>
        </aside>
      </div>
    </Layout>
  )
}

export default LandingPage

