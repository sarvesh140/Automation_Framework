import { test, expect } from '../../../helpers/api-fixtures';

let statsResponse: any;
let productsResponse: any[];
let scenesResponse: any;
let portfolioResponse: any;
let filtersResponse: any;
let tokenResponse: any;
let settingsResponse: any;

test.beforeAll(async ({ dashboardApi }) => {
    // Every test below previously re-fetched its own pair of endpoints from scratch
    // (e.g. getStats()/getAnalyticsPortfolio() independently in 4 different tests) —
    // none of these 7 calls depends on another's result, so fetch each exactly once
    // here and let the tests below assert against the shared response.
    [
        statsResponse,
        productsResponse,
        scenesResponse,
        portfolioResponse,
        filtersResponse,
        tokenResponse,
        settingsResponse,
    ] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getProducts(),
        dashboardApi.getScenes(),
        dashboardApi.getAnalyticsPortfolio(),
        dashboardApi.getAnalyticsFilters(),
        dashboardApi.verifyToken(),
        dashboardApi.getSettings(),
    ]);
});

test.describe('API Consistency', { tag: ['@api', '@consistency', '@regression'] }, () => {
    test('stats_products_matches_active_products_count', () => {
        const activeCount = productsResponse.filter((p: any) => p.status !== 'archived').length;
        expect(statsResponse.products).toBe(activeCount);
    });

    test('stats_experiences_matches_scenes_count', () => {
        expect(scenesResponse.scenes.length).toBeGreaterThanOrEqual(statsResponse.experiences);
    });

    test('analytics_overview_products_matches_stats_products', () => {
        expect(portfolioResponse.data.overview.totalProducts).toBe(statsResponse.products);
    });

    test('analytics_overview_experiences_matches_stats_experiences', () => {
        expect(portfolioResponse.data.overview.totalExperiences).toBe(statsResponse.experiences);
    });

    test('analytics_overview_users_matches_stats_users', () => {
        expect(portfolioResponse.data.overview.totalUsers).toBe(statsResponse.totalUsers);
    });

    test('analytics_overview_sessions_matches_stats_sessions', () => {
        expect(portfolioResponse.data.overview.totalSessions).toBe(statsResponse.totalSessions);
    });

    test('analytics_filter_products_match_products_api', () => {
        const productIds = new Set(productsResponse.map((p: any) => p.id));
        for (const fp of filtersResponse.data.products) {
            expect(productIds.has(fp.id)).toBe(true);
        }
    });

    test('settings_tenant_matches_auth_tenant', () => {
        expect(settingsResponse.tenant).toBe(tokenResponse.user.tenant);
    });
});
