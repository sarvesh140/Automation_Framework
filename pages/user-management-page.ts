import { Page, Locator } from '@playwright/test';
import { BasePage } from './base-page';

export class UserManagementPage extends BasePage {
  readonly heading: Locator;
  readonly subHeading: Locator;
  readonly addNewUserHeading: Locator;
  readonly emailInput: Locator;
  readonly addUserBtn: Locator;
  readonly usersHeader: Locator;
  readonly usersSelectedText: Locator;
  readonly enableAccessBtn: Locator;
  readonly disableAccessBtn: Locator;
  readonly deleteBtn: Locator;
  readonly deleteSelectedBtn: Locator;
  readonly refreshBtn: Locator;
  readonly emailColumnHeader: Locator;
  readonly roleColumnHeader: Locator;
  readonly loginAccessColumnHeader: Locator;
  readonly lastSignedInColumnHeader: Locator;
  readonly actionsColumnHeader: Locator;
  readonly selectAllCheckbox: Locator;
  readonly userRowCheckboxes: Locator;
  readonly roleSelect: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: 'User Management' });
    this.subHeading = page.getByText('Manage users for your tenant');
    this.addNewUserHeading = page.getByText('Add New User', { exact: true });
    this.emailInput = page.getByPlaceholder('user@example.com');
    this.addUserBtn = page.getByRole('button', { name: 'Add User' });
    this.usersHeader = page.getByText(/Users \(\d+\)/);
    this.usersSelectedText = page.getByText(/\d+ users? selected/);
    this.enableAccessBtn = page.getByRole('button', { name: 'Enable access' });
    this.disableAccessBtn = page.getByRole('button', { name: 'Disable access' });
    this.deleteBtn = page.getByRole('button', { name: 'Delete', exact: true });
    this.deleteSelectedBtn = page.getByRole('button', { name: /Delete selected/ });
    this.refreshBtn = page.getByRole('button', { name: 'Refresh' });
    this.emailColumnHeader = page.getByRole('columnheader', { name: 'Email' });
    this.roleColumnHeader = page.getByRole('columnheader', { name: 'Role' });
    this.loginAccessColumnHeader = page.getByRole('columnheader', { name: 'Login Access' });
    this.lastSignedInColumnHeader = page.getByRole('columnheader', { name: 'Last Signed-In' });
    this.actionsColumnHeader = page.getByRole('columnheader', { name: 'Actions' });
    this.selectAllCheckbox = page.locator('th input[type="checkbox"]');
    this.userRowCheckboxes = page.locator('td input[type="checkbox"]');
    // The only <select> on this page — the Role dropdown in "Add New User".
    this.roleSelect = page.locator('select').first();
  }

  async open() {
    const origin = new URL(process.env.DEV_BASE_URL ?? 'https://dev.devsatorixr.com/login').origin;
    await super.goto(`${origin}/users`);
  }

  async selectUserRow(index: number = 0) {
    await this.userRowCheckboxes.nth(index).check();
  }

  async unselectUserRow(index: number = 0) {
    await this.userRowCheckboxes.nth(index).uncheck();
  }

  /** The table row for a given user, matched by email text. */
  userRow(email: string): Locator {
    return this.page.locator('tr', { hasText: email });
  }

  /** Per-row "Remove" icon button. */
  removeUserBtn(email: string): Locator {
    return this.userRow(email).getByRole('button', { name: 'Remove' });
  }

  /** Per-row "Edit" icon button. */
  editUserBtn(email: string): Locator {
    return this.userRow(email).getByRole('button', { name: 'Edit' });
  }

  /**
   * Per-row Login Access toggle. The real checkbox is `sr-only` (visually hidden
   * for accessibility) — clicking it directly makes Playwright wait forever for
   * it to become "visible", so this targets the visible <label> wrapping it,
   * same as a real user's click would.
   */
  loginAccessToggle(email: string): Locator {
    return this.userRow(email).locator('label.relative.inline-flex');
  }

  /** Per-row "Enabled"/"Disabled" login access badge. */
  loginAccessStatus(email: string): Locator {
    return this.userRow(email).locator('[data-testid="user-login-access-status"]');
  }
}
