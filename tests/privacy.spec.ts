import { expect, test } from '@playwright/test'
import { basic, credit, finance, house, loan, start, synthetic, usableLayout } from './journey'

test('합성 금융 입력의 저장·전송·URL·로그 부재 및 새로고침 초기화', async ({ page, context }) => {
  // Keep only counters/booleans in audit output; never print captured payloads or logs.
  const markers = Object.values(synthetic).flatMap((value) => [value, Number(value).toLocaleString('ko-KR')])
  let externalRequests = 0
  let sensitiveRequests = 0
  let sensitiveLogs = 0
  let pageErrors = 0
  let invalidNavigation = 0
  let externalSockets = 0
  let unexpectedWrites = 0
  const logChecks: Promise<void>[] = []
  const containsMarker = (text: string) => markers.some((marker) => text.includes(marker))
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (!['GET', 'HEAD'].includes(request.method())) unexpectedWrites++
    if (url.origin !== 'http://127.0.0.1:5173') externalRequests++
    if (containsMarker(decodeURIComponent(request.url())) || containsMarker(request.postData() ?? '') || containsMarker(JSON.stringify(request.headers()))) sensitiveRequests++
  })
  page.on('websocket', (socket) => {
    // Vite's local HMR socket is expected in this development-server test.
    if (new URL(socket.url()).host !== '127.0.0.1:5173') externalSockets++
    socket.on('framesent', ({ payload }) => { if (containsMarker(String(payload))) sensitiveRequests++ })
  })
  page.on('console', (message) => {
    if (containsMarker(message.text())) sensitiveLogs++
    logChecks.push(Promise.all(message.args().map((argument) => argument.jsonValue().catch(() => undefined))).then((args) => {
      if (containsMarker(JSON.stringify(args))) sensitiveLogs++
    }))
  })
  page.on('pageerror', () => { pageErrors++ })
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return
    const url = new URL(frame.url())
    if (url.search || url.hash || !/^\/(diagnosis\/(basic|finance|credit|house|loan|result))?$/.test(url.pathname)) invalidNavigation++
  })
  await context.addInitScript(() => {
    const audit = { storageWrites: 0, cookieWrites: 0 }
    Object.defineProperty(window, '__homefitPrivacyAudit', { value: audit })
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) { audit.storageWrites++; return setItem.call(this, key, value) }
    const cookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')
    if (cookie?.get && cookie.set) Object.defineProperty(document, 'cookie', {
      get: () => cookie.get!.call(document),
      set: (value: string) => { audit.cookieWrites++; cookie.set!.call(document, value) },
    })
  })
  const checkPrivacy = async () => {
    await Promise.all(logChecks)
    const persisted = await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length, cookiePresent: document.cookie !== '', audit: (window as unknown as { __homefitPrivacyAudit: { storageWrites: number; cookieWrites: number } }).__homefitPrivacyAudit }))
    expect(persisted).toEqual({ local: 0, session: 0, cookiePresent: false, audit: { storageWrites: 0, cookieWrites: 0 } })
    expect((await context.cookies()).length).toBe(0)
    expect({ externalRequests, sensitiveRequests, sensitiveLogs, pageErrors, invalidNavigation, externalSockets, unexpectedWrites }).toEqual({ externalRequests: 0, sensitiveRequests: 0, sensitiveLogs: 0, pageErrors: 0, invalidNavigation: 0, externalSockets: 0, unexpectedWrites: 0 })
  }
  const expectEmptyForm = async () => {
    for (const field of await page.locator('form input, form select').all()) await expect(field).toHaveValue('')
  }
  await start(page)
  await usableLayout(page)
  await basic(page)
  await checkPrivacy()
  await finance(page)
  await checkPrivacy()
  await credit(page)
  await house(page)
  await checkPrivacy()
  await loan(page)
  await page.getByRole('tab', { name: '시뮬레이션', exact: true }).click()
  await page.getByLabel('시뮬레이션 희망 대출금액').fill('210001239')
  await checkPrivacy()
  await page.reload()
  await expect(page).toHaveURL(/\/diagnosis\/basic$/)
  await expectEmptyForm()
  await expect(page.getByLabel('만 나이')).toHaveValue('')
  await expect(page.getByLabel('혼인 상태')).toHaveValue('')
  // Completing only required preceding steps lets us inspect later drafts after refresh.
  await basic(page)
  await expectEmptyForm()
  await expect(page.getByLabel('본인 연소득')).toHaveValue('')
  await expect(page.getByLabel('보유 현금·예금')).toHaveValue('')
  await finance(page)
  await expectEmptyForm()
  await expect(page.getByLabel('신용점수')).toHaveValue('')
  await expect(page.getByLabel('기존 대출 여부')).toHaveValue('')
  await credit(page)
  await expectEmptyForm()
  await expect(page.getByLabel('매매가격')).toHaveValue('')
  await expect(page.getByLabel('감정평가액')).toHaveValue('')
  await house(page)
  await expectEmptyForm()
  await expect(page.getByLabel('희망 대출금액')).toHaveValue('')
  await expect(page.getByLabel('가정 연이율')).toHaveValue('')
  await expect(page.getByLabel('대출 기간')).toHaveValue('')
  await checkPrivacy()
})
