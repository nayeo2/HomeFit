import type { ReactNode } from 'react'
import { Container } from './Container'
import { Link } from 'react-router-dom'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">본문으로 바로가기</a>
      <header className="site-header">
        <Container>
          <Link className="brand" to="/" aria-label="HomeFit 홈">HomeFit</Link>
          <span className="brand-caption">나에게 맞는 내 집 마련</span>
          <Link className="home-link" to="/">홈으로</Link>
        </Container>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Container>{children}</Container>
      </main>
      <footer className="site-footer">
        <Container>
          <p>HomeFit · 내 집 마련을 위한 첫걸음</p>
          <p>사전진단은 참고용이며 실제 금융기관의 대출 승인을 보장하지 않습니다.</p>
        </Container>
      </footer>
    </div>
  )
}
