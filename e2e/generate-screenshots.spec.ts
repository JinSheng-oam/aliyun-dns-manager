import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const screenshotsDir = path.join(process.cwd(), 'docs', 'screenshots');

test.describe('Generate Documentation Screenshots', () => {
  test.beforeAll(async () => {
    await fs.mkdir(screenshotsDir, { recursive: true });
  });

  test('Generate full suite of rich UI screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // 1. Login
    await page.goto('/login');
    await page.getByPlaceholder('管理员密码').fill('e2e-admin-password');
    await page.getByRole('button', { name: '验证并进入' }).click();
    await expect(page).toHaveURL(/\/$/);

    // 2. Add realistic Demo AccessKeys
    await page.goto('/keys');
    const existingKey = await page.getByText('生产环境 (主账号)').isVisible().catch(() => false);
    if (!existingKey) {
      await page.getByRole('button', { name: '添加密钥' }).click();
      await page.getByPlaceholder(/备注名称/).fill('生产环境 (主账号)');
      await page.getByPlaceholder('LTAI...').fill('LTAI_DEMO_PRODUCTION_KEY');
      await page.getByPlaceholder('Secret...').fill('Wk9s8xProdSecretKeySecure456');
      await page.getByRole('button', { name: '保存', exact: true }).click();
      await expect(page.getByText('生产环境 (主账号)')).toBeVisible();

      await page.getByRole('button', { name: '添加密钥' }).click();
      await page.getByPlaceholder(/备注名称/).fill('测试环境 (RAM子账号)');
      await page.getByPlaceholder('LTAI...').fill('LTAI_DEMO_STAGING_KEY');
      await page.getByPlaceholder('Secret...').fill('mN3b5vStagingSecretKey789');
      await page.getByRole('button', { name: '保存', exact: true }).click();
      await expect(page.getByText('测试环境 (RAM子账号)')).toBeVisible();
    }

    // 3. Capture Dashboard (Light Mode)
    await page.goto('/');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotsDir, '01-dashboard-light.png') });

    // 4. Capture Domain List (Grid View - Dark Mode)
    await page.goto('/dns');
    await expect(page.getByText('example.com')).toBeVisible();

    const checkBtn = page.getByRole('button', { name: '检查全部域名' });
    if (await checkBtn.isVisible()) {
      await checkBtn.click();
      await page.waitForTimeout(1000);
    }

    await page.getByRole('button', { name: '深色模式' }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotsDir, '02-domains-grid-dark.png') });

    // Switch back to light mode
    await page.getByRole('button', { name: '浅色模式' }).click();
    await page.waitForTimeout(400);

    // 5. Capture Domain List (Table View - Light Mode)
    await page.getByTitle('列表表格视图').click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotsDir, '03-domains-table-light.png') });

    // 6. Enter Domain (DNS Records View)
    await page.getByText('example.com').first().click();
    await expect(page.getByText('104.21.58.102')).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotsDir, '04-dns-records-light.png') });

    // 7. Capture Snapshots Panel (with created snapshot)
    await page.getByTitle('快照与恢复').click();
    await expect(page.getByText('快照与安全恢复')).toBeVisible();
    const createSnapshotBtn = page.getByRole('button', { name: '创建快照' });
    if (await createSnapshotBtn.isVisible()) {
      await createSnapshotBtn.click();
      await page.waitForTimeout(800);
    }
    await page.screenshot({ path: path.join(screenshotsDir, '06-dns-snapshots.png') });
    await page.getByTitle('关闭快照面板').click();
    await page.waitForTimeout(300);

    // 8. Capture DNS Health Diagnostic Panel (after check completes)
    await page.getByTitle('健康检查').click();
    await expect(page.getByText('DNS 健康检查')).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(screenshotsDir, '05-dns-health-check.png') });
    await page.getByTitle('关闭健康检查').click();
    await page.waitForTimeout(300);

    // 9. Capture Logs Viewer
    await page.goto('/dns');
    const logsBtn = page.getByRole('button', { name: '操作日志' });
    if (await logsBtn.isVisible()) {
      await logsBtn.click();
      await expect(page.getByRole('dialog', { name: '操作日志' })).toBeVisible();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(screenshotsDir, '07-logs-viewer.png') });
      await page.getByTitle('关闭').click();
    }

    // 10. Capture Security Page
    await page.goto('/security');
    await expect(page.getByText('安全检查').first()).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotsDir, '08-security-audit.png') });
  });
});
