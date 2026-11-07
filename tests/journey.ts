import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// Synthetic fixtures only. Distinct markers make accidental disclosure detectable.
export const synthetic = { income: '61000123', cash: '110001237', price: '510001237', principal: '310001239' }
export async function start(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('link', { name: '내 집 마련 진단 시작하기' })).toBeVisible()
  await expect(page.locator('#diagnosis-status')).not.toContainText('준비 중')
  await page.getByRole('link', { name: '내 집 마련 진단 시작하기' }).click()
  await expect(page).toHaveURL(/\/diagnosis\/basic$/)
}
export async function basic(page: Page, married = false) {
  await page.getByLabel('만 나이').fill('35')
  await page.getByLabel('혼인 상태').selectOption(married ? 'married' : 'single')
  await page.getByLabel('세대 보유 주택 수').fill(married ? '1' : '0')
  await page.getByLabel('생애 최초 주택 구입 여부').selectOption('no')
  await page.getByRole('button', { name: '다음 · 소득·자산' }).click()
  await expect(page).toHaveURL(/\/diagnosis\/finance$/)
}
export async function finance(page: Page) {
  await page.getByLabel('근로·소득 유형').selectOption('employee')
  await page.getByLabel('본인 연소득').fill(synthetic.income)
  await page.getByLabel('소득 증빙 상태').selectOption('available')
  await page.getByLabel('보유 현금·예금').fill(synthetic.cash)
  await page.getByLabel('월 상환 가능 예산').fill('2100012')
  await page.getByRole('button', { name: '다음 · 부채·신용' }).click()
  await expect(page).toHaveURL(/\/diagnosis\/credit$/)
}
export async function credit(page: Page) {
  await page.getByLabel('신용평가사').selectOption('KCB')
  await page.getByLabel('신용점수').fill('811')
  await page.getByLabel('연체 여부').selectOption('no')
  await page.getByLabel('채무조정 여부').selectOption('no')
  await page.getByLabel('기존 대출 여부').selectOption('no')
  await page.getByRole('button', { name: '다음 · 주택정보' }).click()
  await expect(page).toHaveURL(/\/diagnosis\/house$/)
}
export async function house(page: Page) {
  await page.getByLabel('소재지 시·도').fill('테스트시')
  await page.getByLabel('소재지 시·군·구').fill('테스트구')
  await page.getByLabel('주택 유형').fill('아파트')
  await page.getByLabel('매매가격').fill(synthetic.price)
  await page.getByLabel('감정평가액').fill('490001237')
  await page.getByLabel('예상 취득 비용').fill('12000123')
  await page.getByRole('button', { name: '다음 · 대출조건' }).click()
  await expect(page).toHaveURL(/\/diagnosis\/loan$/)
}
export async function loan(page: Page) {
  await page.getByLabel('희망 대출금액').fill(synthetic.principal)
  await page.getByLabel('가정 연이율').fill('4.125')
  await page.getByLabel('대출 기간').fill('30')
  await page.getByLabel('금리 유형').selectOption('variable')
  await page.getByLabel('상환 방식').selectOption('equalPayment')
  await page.getByRole('button', { name: '다음 · 진단 결과' }).click()
  await expect(page).toHaveURL(/\/diagnosis\/result$/)
}
export async function results(page: Page) {
  await start(page)
  await basic(page)
  await finance(page)
  await credit(page)
  await house(page)
  await loan(page)
  await expect(page).toHaveURL(/\/diagnosis\/result$/)
}
export async function usableLayout(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const controls = await page.locator('input:visible, select:visible').evaluateAll((inputs) => inputs.map((input) => {
    const box = input.getBoundingClientRect()
    return { id: input.id, height: box.height, x: box.x, right: box.right }
  }))
  for (const box of controls) {
    expect(box.height, `control height: ${box.id}`).toBeGreaterThanOrEqual(44)
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.right).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0)
  }
}
