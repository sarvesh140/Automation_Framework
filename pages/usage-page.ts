import { Page, Locator } from '@playwright/test';
import { BasePage } from './base-page';

export class UsagePage extends BasePage {
  // Page header
  readonly heading: Locator;

  // Tab bar — rendered as tab-style divs, not semantic <button>s
  readonly creditsTab: Locator;
  readonly storageTab: Locator;
  readonly viewsTab: Locator;

  // Credits Consumption card
  readonly creditsConsumptionHeading: Locator;
  readonly tenantSubtext: Locator;
  readonly allocationLabel: Locator;
  readonly creditsConsumedLabel: Locator;
  readonly remainingBalanceLabel: Locator;

  // Breakdown section
  readonly breakdownHeading: Locator;
  readonly byUserBtn: Locator;
  readonly byProductBtn: Locator;
  readonly byExperienceBtn: Locator;
  readonly exportCsvBtn: Locator;
  readonly userColumnHeader: Locator;
  readonly percentColumnHeader: Locator;
  readonly creditsColumnHeader: Locator;

  // Storage tab
  readonly storageConsumptionHeading: Locator;

  // Views tab — its breakdown section is labelled "Usage Breakdown", not "Breakdown"
  readonly viewsUsageHeading: Locator;
  readonly usageBreakdownHeading: Locator;

  // Usage trend
  readonly usageTrendHeading: Locator;

  // Data rows of the currently-active breakdown table
  readonly breakdownRows: Locator;

  constructor(page: Page) {
    super(page);
    // Debug confirmed headings: ['Usage', 'Credits Consumption', 'Breakdown', 'Usage trend']
    // exact:true prevents matching 'Usage trend' h3
    this.heading = page.getByRole('heading', { name: 'Usage', exact: true });
    // Debug confirmed tabs are real <button> elements
    this.creditsTab = page.getByRole('button', { name: 'Credits', exact: true });
    this.storageTab = page.getByRole('button', { name: 'Storage', exact: true });
    this.viewsTab = page.getByRole('button', { name: 'Views', exact: true });
    this.creditsConsumptionHeading = page.getByRole('heading', { name: 'Credits Consumption' });
    this.tenantSubtext = page.getByText('Tenant-wide AI workflow usage.');
    this.allocationLabel = page.getByText('Allocation', { exact: true });
    this.creditsConsumedLabel = page.getByText('Credits Consumed', { exact: true });
    this.remainingBalanceLabel = page.getByText('Remaining Balance', { exact: true });
    this.breakdownHeading = page.getByRole('heading', { name: 'Breakdown' });
    // Breakdown filter tabs — also real <button>s per DOM inspection
    this.byUserBtn = page.getByRole('button', { name: 'By user' });
    this.byProductBtn = page.getByRole('button', { name: 'By product' });
    this.byExperienceBtn = page.getByRole('button', { name: 'By experience' });
    this.exportCsvBtn = page.getByRole('button', { name: 'Export CSV' });
    this.userColumnHeader = page.getByRole('columnheader', { name: 'User' });
    this.percentColumnHeader = page.getByRole('columnheader', { name: '% of total' });
    this.creditsColumnHeader = page.getByRole('columnheader', { name: 'Credits' });
    this.usageTrendHeading = page.getByRole('heading', { name: 'Usage trend' });
    this.storageConsumptionHeading = page.getByRole('heading', { name: 'Storage Consumption' });
    this.viewsUsageHeading = page.getByRole('heading', { name: 'Views Usage' });
    this.usageBreakdownHeading = page.getByRole('heading', { name: 'Usage Breakdown' });
    this.breakdownRows = page.locator('table tbody tr');
  }

  /** Breakdown filter button for a given dimension, e.g. "By product", "By type", "By source". */
  breakdownFilterBtn(label: string): Locator {
    return this.page.getByRole('button', { name: label });
  }

  /** Column header cell of the currently-active breakdown table, e.g. "Product", "Experience". */
  columnHeader(name: string): Locator {
    return this.page.getByRole('columnheader', { name });
  }

  async open() {
    const origin = new URL(process.env.DEV_BASE_URL ?? 'https://dev.devsatorixr.com/login').origin;
    // networkidle never resolves here — the app polls persistently (see CLAUDE.md) —
    // so wait for the one concrete element the credits card renders once its data lands.
    await super.goto(`${origin}/usage`);
    await this.creditsConsumedLabel.waitFor({ state: 'visible', timeout: 30000 });
  }

  /** Returns the displayed "Credits Consumed" value as a number (e.g. "2,043" → 2043) */
  async getDisplayedCreditsConsumed(): Promise<number> {
    const valueLocator = this.page.locator('text=/^[\\d,]+$/').first();
    const text = await valueLocator.innerText();
    return parseInt(text.replace(/,/g, ''), 10);
  }
}
