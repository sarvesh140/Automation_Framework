import { test, expect } from '../../../helpers/cross-fixtures';
import { UsagePage } from '../../../pages/usage-page';

test.use({ video: 'on' });

// Read-only journey — it only drives tab/filter switches on the Usage page and
// creates no server-side resource, so there is nothing for an afterEach to clean up
// (same reasoning as tests/workflow/analytics/experience_drilldown.spec.ts).
test.describe('Workflow — Usage: drill through breakdown dimensions, export CSV, then tour every tab', { tag: ['@workflow', '@regression'] }, () => {
  test('switch Credits breakdown dimensions cross-checked against the API, export CSV, then tour Storage and Views', async ({ page, dashboardApi }) => {
    test.setTimeout(60000);

    const usagePage = new UsagePage(page);

    await test.step('Open the Usage page in its default Credits view', async () => {
      await usagePage.open();
      await expect(usagePage.creditsConsumptionHeading).toBeVisible();
    });

    await test.step('Cross-verify the displayed Credits Consumed value against /api/credits/summary', async () => {
      const summary = await dashboardApi.getCreditsSummary('current_month');
      const displayed = await usagePage.getDisplayedCreditsConsumed();
      expect(displayed).toBe(Math.round(summary.totals.credits));
    });

    await test.step('Switch the breakdown to "By product" and cross-check against /api/credits/breakdown', async () => {
      const breakdown = await dashboardApi.getCreditsBreakdown('product', 'current_month');
      await usagePage.byProductBtn.click();

      await expect(usagePage.columnHeader('Product')).toBeVisible();
      // Credit usage for a dimension can legitimately be zero for the current period —
      // the table then renders a "no usage" placeholder row instead of data rows, so
      // the row count only lines up with the API when there's actually data to show.
      if (breakdown.rows.length > 0) {
        await expect(usagePage.breakdownRows).toHaveCount(breakdown.rows.length);
      } else {
        await expect(usagePage.breakdownRows).toHaveText(/No usage recorded/);
      }
    });

    await test.step('Switch the breakdown to "By experience" and cross-check against the API', async () => {
      const breakdown = await dashboardApi.getCreditsBreakdown('experience', 'current_month');
      await usagePage.byExperienceBtn.click();

      await expect(usagePage.columnHeader('Experience')).toBeVisible();
      if (breakdown.rows.length > 0) {
        await expect(usagePage.breakdownRows).toHaveCount(breakdown.rows.length);
      } else {
        await expect(usagePage.breakdownRows).toHaveText(/No usage recorded/);
      }
    });

    await test.step('Export the Credits breakdown as CSV', async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        usagePage.exportCsvBtn.click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/^credit-usage-current_month-\d{4}-\d{2}-\d{2}\.csv$/);
    });

    await test.step('Switch to the Storage tab', async () => {
      await usagePage.storageTab.click();

      await expect(usagePage.storageConsumptionHeading).toBeVisible();
      await expect(usagePage.breakdownHeading).toBeVisible();
      await expect(usagePage.creditsConsumptionHeading).not.toBeVisible();
    });

    await test.step('Switch to the Views tab', async () => {
      await usagePage.viewsTab.click();

      await expect(usagePage.viewsUsageHeading).toBeVisible();
      await expect(usagePage.usageBreakdownHeading).toBeVisible();
      await expect(usagePage.breakdownRows.first()).toBeVisible();
    });

    await test.step('Return to the Credits tab — the original view is restored', async () => {
      await usagePage.creditsTab.click();

      await expect(usagePage.creditsConsumptionHeading).toBeVisible();
      await expect(usagePage.viewsUsageHeading).not.toBeVisible();
    });
  });
});
