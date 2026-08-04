import { APIRequestContext, test } from '@playwright/test';

export class APIError extends Error {
    constructor(public endpoint: string, public status: number, public expected: number = 200) {
        super(`API ${endpoint} returned status ${status} (expected ${expected})`);
        this.name = 'APIError';
    }
}

export class ApiService {
    constructor(private request: APIRequestContext) {}

    private async _get(endpoint: string): Promise<any> {
        const response = await this.request.get(endpoint);
        if (response.status() !== 200) {
            throw new APIError(endpoint, response.status());
        }
        return await response.json();
    }

    private async _delete(endpoint: string): Promise<any> {
        const response = await this.request.delete(endpoint);
        if (response.status() !== 200) {
            throw new APIError(endpoint, response.status());
        }
        return await response.json().catch(() => undefined);
    }

    async verifyToken(): Promise<any> {
        return test.step('API — verify auth token', async () => {
            return this._get('/api/auth/verify-token');
        });
    }

    async getStats(): Promise<any> {
        return test.step('API — fetch dashboard stats', async () => {
            return this._get('/api/stats');
        });
    }

    async getProducts(): Promise<any[]> {
        return test.step('API — fetch products list', async () => {
            return this._get('/api/products');
        });
    }

    async getActiveProductsCount(): Promise<number> {
        return test.step('API — count active (non-archived) products', async () => {
            const products = await this.getProducts();
            return products.filter((p: any) => p.status !== 'archived').length;
        });
    }

    async getScenes(): Promise<any> {
        return test.step('API — fetch scenes list', async () => {
            return this._get('/api/scenes');
        });
    }

    async getHdris(): Promise<{ items: any[]; count: number }> {
        return test.step('API — fetch HDRI catalog', async () => {
            return this._get('/api/hdri');
        });
    }

    async deleteHdri(id: string): Promise<any> {
        return test.step(`API — delete HDRI "${id}"`, async () => {
            return this._delete(`/api/hdri/${id}`);
        });
    }

    async getMaterialPresets(): Promise<{ items: any[]; count: number }> {
        return test.step('API — fetch material presets', async () => {
            return this._get('/api/material-presets');
        });
    }

    async deleteMaterialPreset(id: string): Promise<any> {
        return test.step(`API — delete material preset "${id}"`, async () => {
            return this._delete(`/api/material-presets/${id}`);
        });
    }

    async getSettings(): Promise<any> {
        return test.step('API — fetch settings', async () => {
            return this._get('/api/settings');
        });
    }

    async getCategories(): Promise<any> {
        return test.step('API — fetch categories', async () => {
            return this._get('/api/categories');
        });
    }

    async getUsers(): Promise<any> {
        return test.step('API — fetch users', async () => {
            return this._get('/api/users');
        });
    }

    async deleteUser(email: string): Promise<any> {
        return test.step(`API — remove user "${email}"`, async () => {
            return this._delete(`/api/users/${encodeURIComponent(email)}`);
        });
    }

    async getAnalyticsPortfolio(): Promise<any> {
        return test.step('API — fetch analytics portfolio', async () => {
            return this._get('/api/new-analytics/portfolio');
        });
    }

    async getAnalyticsFilters(): Promise<any> {
        return test.step('API — fetch analytics filters', async () => {
            return this._get('/api/new-analytics/filter-options');
        });
    }

    async getAnalyticsEvents(experienceId?: string): Promise<any> {
        return test.step('API — fetch analytics events', async () => {
            const query = experienceId ? `?experienceId=${experienceId}` : '';
            return this._get(`/api/new-analytics/events${query}`);
        });
    }

    async getAnalyticsSummary(experienceId?: string): Promise<any> {
        return test.step('API — fetch analytics summary', async () => {
            const query = experienceId ? `?experienceId=${experienceId}` : '';
            return this._get(`/api/new-analytics/summary${query}`);
        });
    }

    async getAnalyticsDashboard(experienceId?: string): Promise<any> {
        return test.step('API — fetch analytics dashboard (optionally scoped to an experience)', async () => {
            const query = experienceId ? `?experienceId=${experienceId}` : '';
            return this._get(`/api/new-analytics/dashboard${query}`);
        });
    }

    async getCreditsSummary(period: string = 'current_month'): Promise<any> {
        return test.step('API — fetch credits summary', async () => {
            return this._get(`/api/credits/summary?period=${period}`);
        });
    }

    async getCreditsBreakdown(dimension: string = 'user', period: string = 'current_month'): Promise<any> {
        return test.step('API — fetch credits breakdown', async () => {
            return this._get(`/api/credits/breakdown?period=${period}&dimension=${dimension}`);
        });
    }
}
