import { test, expect } from '../../../helpers/cross-fixtures';
import { UserManagementPage } from '../../../pages/user-management-page';

const TEST_EMAIL = 'test6@satorixr.com';

test.use({ video: 'on' });

test.describe('Workflow — User Management: add a user, disable their login access, then remove them', { tag: ['@workflow', '@regression'] }, () => {
  // This tenant is shared/live, so a failed run must not leave the test user behind —
  // same reasoning as the material/background management workflows' own cleanup.
  test.beforeAll(async ({ dashboardApi }) => {
    const { users } = await dashboardApi.getUsers();
    if (users.some((u: any) => u.email === TEST_EMAIL)) {
      await dashboardApi.deleteUser(TEST_EMAIL);
    }
  });

  test.afterEach(async ({ dashboardApi }) => {
    const { users } = await dashboardApi.getUsers();
    if (users.some((u: any) => u.email === TEST_EMAIL)) {
      await dashboardApi.deleteUser(TEST_EMAIL);
    }
  });

  test(`add "${TEST_EMAIL}" as a Member, disable their login access, then remove them`, async ({ page, dashboardApi }) => {
    const userPage = new UserManagementPage(page);

    await test.step('Open User Management and add the test user as a Member', async () => {
      await userPage.open();
      await expect(userPage.heading).toBeVisible();

      await userPage.emailInput.fill(TEST_EMAIL);
      await userPage.roleSelect.selectOption({ label: 'Member' });
      await userPage.addUserBtn.click();

      await expect(userPage.userRow(TEST_EMAIL)).toBeVisible({ timeout: 10000 });
    });

    await test.step('Cross-verify with API — user created as Member, login access enabled', async () => {
      const { users } = await dashboardApi.getUsers();
      const created = users.find((u: any) => u.email === TEST_EMAIL);
      expect(created).toBeTruthy();
      expect(created.role).toBe('Member');
      expect(created.isActive).toBe(true);
    });

    await test.step("Disable the user's login access via their row toggle", async () => {
      await expect(userPage.loginAccessStatus(TEST_EMAIL)).toHaveText('Enabled');
      await userPage.loginAccessToggle(TEST_EMAIL).click();
      await expect(userPage.loginAccessStatus(TEST_EMAIL)).toHaveText('Disabled');
    });

    await test.step('Cross-verify with API — login access is now disabled', async () => {
      const { users } = await dashboardApi.getUsers();
      const updated = users.find((u: any) => u.email === TEST_EMAIL);
      expect(updated.isActive).toBe(false);
    });

    await test.step('Remove the user and confirm the native browser dialog', async () => {
      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toBe(`Are you sure you want to remove ${TEST_EMAIL}?`);
        await dialog.accept();
      });
      await userPage.removeUserBtn(TEST_EMAIL).click();

      await expect(userPage.userRow(TEST_EMAIL)).toHaveCount(0);
    });

    await test.step('Cross-verify with API — user no longer present', async () => {
      const { users } = await dashboardApi.getUsers();
      expect(users.some((u: any) => u.email === TEST_EMAIL)).toBe(false);
    });
  });
});
