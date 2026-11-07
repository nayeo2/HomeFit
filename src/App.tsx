import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { DiagnosisPage } from './pages/DiagnosisPage'
import { diagnosisSteps } from './diagnosisSteps'
import LandingPage from './pages/LandingPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        {diagnosisSteps.map((step, index) => (
          <Route key={step.path} path={step.path} element={<DiagnosisPage stepIndex={index} />} />
        ))}
        <Route path="*" element={
          <Layout>
            <section className="diagnosis-page" aria-labelledby="not-found-title">
              <p className="eyebrow">404</p>
              <h1 id="not-found-title">페이지를 찾을 수 없어요</h1>
              <p className="intro">주소를 확인하거나 홈으로 돌아가 주세요.</p>
              <Link className="button" to="/">홈으로 돌아가기</Link>
            </section>
          </Layout>
        } />
      </Routes>
    </BrowserRouter>
  )
}

export default App
