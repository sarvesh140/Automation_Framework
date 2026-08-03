import { test, expect } from '../../../helpers/auth-fixtures';
import { UsagePage } from '../../../pages/usage-page';

test.describe('Settings — Usage UI Exhaustive', { tag: ['@ui', '@regression'] }, () => {

  test('Usage page heading is visible', { tag: ['@smoke'] }, async ({ page }) => {
    const usagePage = new UsagePage(page);
    await usagePage.open();
    await expect(usagePage.heading).toBeVisible();
  });

  test('URL resolves to /usage route', async ({ page }) => {
    const usagePage = new UsagePage(page);
    await usagePage.open();
    await expect(page).toHaveURL(/\/usage/);
  });

  test.describe('Tab Navigation', () => {
    test('Credits tab is visible', async ({ page }) => {
      const usagePage = new UsagePage(page);
      await usagePage.open();
      await expect(usagePage.creditsTab).toBeVisible();
    });

    test('Storage tab is visible', async ({ page }) => {
      const usagePage = new UsagePage(page);
      await usagePage.open();
      await expect(usagePage.storageTab).toBeVisible();
    });

    test('Views tab is visible', async ({ page }) => {
      const usagePage = new UsagePage(page);
      await usagePage.open();
      await expect(usagePage.viewsTab).toBeVisible();
    });

    test('Clicking Storage tab switches to the Storage Consumption view', async ({ page }) => {
      const usagePage = new UsagePage(page);
      await usagePage.open();

      await usagePage.storageTab.click();

      await expect(usagePage.storageConsumptionHeading).toBeVisible();
      await expect(usagePage.creditsConsumptionHeading).not.toBeVisible();
    });

    test('Clicking Views tab switches to the Views Usage view', async ({ page }) => {
      const usagePage = new UsagePage(page);
      await usagePage.open();

      await usagePage.viewsTab.click();

      await expect(usagePage.viewsUsageHeading).toBeVisible();
      await expect(usagePage.usageBreakdownHeading).toBeVisible();
      await expect(usagePage.creditsConsumptionHeading).not.toBeVisible();
    });

    test('Clicking Credits tab returns to the Credits Consumption view', async ({ page }) => {
      const usagePage = new UsagePage(page);
      await usagePage.open();

      await usagePage.viewsTab.click();
      await expect(usagePage.viewsUsageHeading).toBeVisible();

      await usagePage.creditsTab.click();

      await expect(usagePage.creditsConsumptionHeading).toBeVisible();
      await expect(usagePage.viewsUsageHeading).not.toBeVisible();
    });
  });

  test.describe('Credits Consumption Card', () => {
    test('Credits Consumption heading is visible', async ({ page }) => {
      const usagePage = new UsagePage(page);
      await usagePage.open();
      await expect(usagePage.creditsConsumptionHeading).toBeVisible();
    });

    test('Tenant-wide AI workflow usage subtext is visible', async ({ page }) => {
      const usagePage = new UsagePage(page);
      await usagePage.open();
      await expect(usagePage.tenantSubtext).toBeVisible();
    });

    test('Allocation label is visible', async ({ page }) => {
      const usagePage = new UsagePage(page);
      await usagePage.open();
      await expect(usagePage.allocationLabel).toBeVisible();
    });

    test('Credits Consumed label is visible', async ({ page }) => {
      const usagePage = new UsagePage(page);
      await usagePage.open();
      await expect(usagePage.creditsConsumedLabel).toBeVisible();
    });

    test('Remaining Balance label is visible', async ({ page }) => {
      const usagePage = new UsagePage(page);
      await usagePage.open();
      await expect(usagePage.remainingBalanceLabel).toBeVisible();
    });
  });

  test.describe('Breakdown Section', () => {
    test('Breakdown heading is visible', async ({ page }) => {
      const usagePage = new UsagePage(page);
      await usagePage.open();
      await expect(usagePage.breakdownHeading).toBeVisible();
    });

    test('By user filter button is visible', async ({ page }) => {
      const usagePage = new UsagePage(page);
      await usagePage.open();
      await expect(usagePage.byUserBtn).toBeVisible();
    });

    test('By product filter button is visible', async ({ page }) => {
      const usagePage = new UsagePage(page);
      await usagePage.open();
      await expect(usagePage.byProductBtn).toBeVisible();
    });

    test('By experience filter button is visible', async ({ page }) => {
      const usagePage = new UsagePage(page);
      await usagePage.open();
      await expect(usagePage.byExperienceBtn).toBeVisible();
    });

    test('Export CSV button is visible', async ({ page }) => {
      const usagePage = new UsagePage(page);
      await usagePage.open();
      await expect(usagePage.exportCsvBtn).toBeVisible();
    });

    test('User column header is visible', async ({ page }) => {
      const usagePage = new UsagePage(page);
      await usagePage.open();
      await expect(usagePage.userColumnHeader).toBeVisible();
    });

    test('% of total column header is visible', async ({ page }) => {
      const usagePage = new UsagePage(page);
      await usagePage.open();
      await expect(usagePage.percentColumnHeader).toBeVisible();
    });

    test('Credits column header is visible', async ({ page }) => {
      const usagePage = new UsagePage(page);
      await usagePage.open();
      await expect(usagePage.creditsColumnHeader).toBeVisible();
    });

    test('Clicking By product switches the breakdown table to a Product column', async ({ page }) => {
      const usagePage = new UsagePage(page);
      await usagePage.open();

      await usagePage.byProductBtn.click();

      await expect(usagePage.columnHeader('Product')).toBeVisible();
      await expect(usagePage.userColumnHeader).not.toBeVisible();
    });

    test('Clicking By experience switches the breakdown table to an Experience column', async ({ page }) => {
      const usagePage = new UsagePage(page);
      await usagePage.open();

      await usagePage.byExperienceBtn.click();

      await expect(usagePage.columnHeader('Experience')).toBeVisible();
      await expect(usagePage.userColumnHeader).not.toBeVisible();
    });

    test('Export CSV button downloads a CSV file', async ({ page }) => {
      const usagePage = new UsagePage(page);
      await usagePage.open();

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        usagePage.exportCsvBtn.click(),
      ]);

      expect(download.suggestedFilename()).toMatch(/^credit-usage-current_month-\d{4}-\d{2}-\d{2}\.csv$/);
    });
  });

  test.describe('Usage Trend Section', () => {
    test('Usage trend heading is visible', async ({ page }) => {
      const usagePage = new UsagePage(page);
      await usagePage.open();
      await expect(usagePage.usageTrendHeading).toBeVisible();
    });
  });
});
