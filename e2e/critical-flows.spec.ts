import { expect, test, type Locator, type Page } from '@playwright/test';

async function expectInsideViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();

  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
}

async function login(page: Page) {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expectInsideViewport(page, page.locator('#login-page form'));

  await page.getByPlaceholder('管理员密码').fill('wrong-password');
  await page.getByRole('button', { name: '验证并进入' }).click();
  await expect(page.getByText('密码错误')).toBeVisible();

  await page.getByPlaceholder('管理员密码').fill('e2e-admin-password');
  await page.getByRole('button', { name: '验证并进入' }).click();
  await expect(page).toHaveURL(/\/$/);
}

test('登录、日志弹窗和 AccessKey 持久化流程', async ({ page, request }) => {
  page.on('dialog', dialog => {
    throw new Error(`不应出现浏览器原生弹窗: ${dialog.type()}`);
  });

  const health = await request.get('/api/health');
  expect(health.ok()).toBeTruthy();
  await expect(health.json()).resolves.toMatchObject({ status: 'ok', version: '0.6.0' });

  await login(page);
  await expect(page.locator('main').getByText('v0.6.0', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'DNS 管理' }).click();
  await page.getByRole('button', { name: '操作日志' }).click();
  const logsDialog = page.getByRole('dialog', { name: '操作日志' });
  await expect(logsDialog).toBeVisible();
  await expectInsideViewport(page, logsDialog);
  await page.getByTitle('关闭').click();
  await expect(logsDialog).toBeHidden();

  await page.getByRole('link', { name: '密钥管理' }).click();
  await page.getByRole('button', { name: '添加密钥' }).click();
  await page.getByPlaceholder(/备注名称/).fill('E2E 测试账号');
  await page.getByPlaceholder('LTAI...').fill('LTAI_E2E_TEST');
  await page.getByPlaceholder('Secret...').fill('e2e-secret-value');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('E2E 测试账号')).toBeVisible();

  await page.reload();
  await expect(page.getByText('E2E 测试账号')).toBeVisible();
  await page.getByRole('button', { name: '修改' }).click();
  await page.getByPlaceholder(/备注名称/).fill('E2E 已修改账号');
  await page.getByRole('button', { name: '保存修改' }).click();
  await expect(page.getByText('E2E 已修改账号')).toBeVisible();

  await page.getByRole('button', { name: '删除 E2E 已修改账号' }).click();
  const confirmDialog = page.getByRole('alertdialog', { name: '删除 AccessKey' });
  await expect(confirmDialog).toBeVisible();
  await expectInsideViewport(page, confirmDialog);
  await confirmDialog.getByRole('button', { name: '取消' }).click();
});

test('移动端导航保持在可视区域内', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);

  await page.getByRole('button', { name: '打开菜单' }).evaluate(button => (button as HTMLButtonElement).click());
  const navigation = page.getByRole('navigation');
  await expect(navigation).toBeVisible();
  await expectInsideViewport(page, navigation);
  await navigation.getByRole('link', { name: '安全检查' }).click();
  await expect(page).toHaveURL(/\/security$/);
  await expect(navigation).toBeHidden();
  await expect(page.getByRole('button', { name: '打开菜单' })).toBeVisible();
});
