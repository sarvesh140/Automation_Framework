import { test, expect } from '../../../helpers/api-fixtures';

let portfolioResponse: any;
let filtersResponse: any;
let dashboardOrgWideResponse: any;

test.beforeAll(async ({ dashboardApi }) => {
    // Independent of each other — no need to pay for 3 sequential round trips.
    [portfolioResponse, filtersResponse, dashboardOrgWideResponse] = await Promise.all([
        dashboardApi.getAnalyticsPortfolio(),
        dashboardApi.getAnalyticsFilters(),
        dashboardApi.getAnalyticsDashboard(),
    ]);
});

test.describe('Analytics Portfolio API', { tag: ['@api', '@regression'] }, () => {
    test('portfolio_top_level_schema', () => {
        expect(portfolioResponse.success).toBe(true);
        expect(portfolioResponse).toHaveProperty('data');
        expect(portfolioResponse).toHaveProperty('tenant');
        expect(typeof portfolioResponse.tenant).toBe('string');
        expect(portfolioResponse).toHaveProperty('generatedAt');
        expect(typeof portfolioResponse.generatedAt).toBe('string');
    });

    test('portfolio_overview_schema', () => {
        const overview = portfolioResponse.data.overview;
        const numericFields = [
            'totalEvents', 'events24h', 'totalProducts', 'totalExperiences',
            'totalUsers', 'totalSessions', 'totalViews', 'totalCompletions',
            'avgSessionsPerExperience'
        ];
        for (const field of numericFields) {
            expect(typeof overview[field]).toBe('number');
            expect(overview[field]).toBeGreaterThanOrEqual(0);
        }
        expect(typeof overview.avgSessionDuration).toBe('string');
    });

    test('portfolio_engagement_schema', () => {
        const engagement = portfolioResponse.data.engagement;
        expect(typeof engagement.totalViews).toBe('number');
        expect(typeof engagement.totalCompletions).toBe('number');
        expect(typeof engagement.avgSessionDuration).toBe('string');
        expect(engagement.totalViews).toBeGreaterThanOrEqual(engagement.totalCompletions);
    });

    test('portfolio_experiences_section', () => {
        const experiences = portfolioResponse.data.experiences;
        expect(typeof experiences.totalExperiences).toBe('number');
        expect(typeof experiences.activeExperiences24h).toBe('number');
        expect(Array.isArray(experiences.mostViewedExperiences)).toBe(true);
        
        for (const exp of experiences.mostViewedExperiences) {
            expect(typeof exp.experienceId).toBe('string');
            expect(typeof exp.experienceName).toBe('string');
            expect(typeof exp.views).toBe('number');
            expect(exp.views).toBeGreaterThanOrEqual(0);
        }
    });

    test('portfolio_most_viewed_sorted_descending', () => {
        const list = portfolioResponse.data.experiences.mostViewedExperiences;
        for (let i = 1; i < list.length; i++) {
            expect(list[i - 1].views).toBeGreaterThanOrEqual(list[i].views);
        }
    });

    test('portfolio_users_section', () => {
        const users = portfolioResponse.data.users;
        expect(typeof users.totalUsers).toBe('number');
        expect(typeof users.totalSessions).toBe('number');
        expect(typeof users.avgSessionsPerExperience).toBe('number');
    });

    test('portfolio_timeline_schema', () => {
        const timeline = portfolioResponse.data.timeline;
        expect(Array.isArray(timeline)).toBe(true);

        if (timeline.length > 0) {
            const entry = timeline[0];
            expect(typeof entry.date).toBe('string');
            expect(typeof entry.totalEvents).toBe('number');
            expect(typeof entry.views).toBe('number');
            expect(typeof entry.hotspotClicks).toBe('number');
            expect(typeof entry.completions).toBe('number');
            expect(typeof entry.desktop).toBe('number');
            expect(typeof entry.mobile).toBe('number');
            expect(typeof entry.tablet).toBe('number');
        }
    });

    test('portfolio_timeline_dates_are_chronological', () => {
        const timeline = portfolioResponse.data.timeline;
        for (let i = 1; i < timeline.length; i++) {
            expect(new Date(timeline[i].date).getTime())
                .toBeGreaterThanOrEqual(new Date(timeline[i - 1].date).getTime());
        }
    });

    test('portfolio_data_has_all_sections', () => {
        const data = portfolioResponse.data;
        const expectedSections = [
            'overview', 'engagement', 'experiences', 'users',
            'timeline', 'deviceDistribution', 'viewSourceBreakdown',
            'topExperiences', 'topUsers', 'userActivityLog',
            'generatedAt', 'filters'
        ];
        for (const section of expectedSections) {
            expect(data).toHaveProperty(section);
        }
    });
});

test.describe('Analytics Dashboard API', { tag: ['@api', '@regression'] }, () => {
    test('dashboard_top_level_schema', () => {
        expect(dashboardOrgWideResponse.success).toBe(true);
        expect(dashboardOrgWideResponse).toHaveProperty('data');
        expect(dashboardOrgWideResponse).toHaveProperty('tenant');
        expect(typeof dashboardOrgWideResponse.tenant).toBe('string');
        expect(dashboardOrgWideResponse).toHaveProperty('generatedAt');
        expect(typeof dashboardOrgWideResponse.generatedAt).toBe('string');
    });

    test('dashboard_overview_is_stripped_down_two_field_variant', () => {
        const overview = dashboardOrgWideResponse.data.overview;
        expect(Object.keys(overview).sort()).toEqual(['events24h', 'totalEvents']);
        expect(typeof overview.totalEvents).toBe('number');
        expect(typeof overview.events24h).toBe('number');
    });

    test('dashboard_user_metrics_schema', () => {
        const userMetrics = dashboardOrgWideResponse.data.userMetrics;
        expect(typeof userMetrics.totalUniqueUsers).toBe('number');
        expect(typeof userMetrics.newUsers).toBe('number');
        expect(typeof userMetrics.recurringUsers).toBe('number');
    });

    test('dashboard_session_metrics_schema', () => {
        const sessionMetrics = dashboardOrgWideResponse.data.sessionMetrics;
        expect(typeof sessionMetrics.totalSessions).toBe('number');
        expect(typeof sessionMetrics.activeSessions).toBe('number');
        expect(typeof sessionMetrics.avgSessionsPerUser).toBe('number');
        expect(typeof sessionMetrics.totalDuration).toBe('string');
        expect(typeof sessionMetrics.avgDurationPerUser).toBe('string');
    });

    test('dashboard_does_not_include_top_experiences_or_flat_users_section', () => {
        expect(dashboardOrgWideResponse.data).not.toHaveProperty('topExperiences');
        expect(dashboardOrgWideResponse.data).not.toHaveProperty('users');
    });

    test('dashboard_data_has_all_sections', () => {
        const data = dashboardOrgWideResponse.data;
        const expectedSections = [
            'overview', 'engagement', 'experiences', 'deviceDistribution',
            'viewSourceBreakdown', 'userMetrics', 'sessionMetrics',
            'topUsers', 'userActivityLog', 'timeline', 'filters', 'generatedAt'
        ];
        for (const section of expectedSections) {
            expect(data).toHaveProperty(section);
        }
    });
});

test.describe('Analytics Filters API', { tag: ['@api', '@regression'] }, () => {
    test('filters_top_level_schema', () => {
        expect(filtersResponse.success).toBe(true);
        expect(filtersResponse).toHaveProperty('data');
        expect(filtersResponse).toHaveProperty('tenant');
        expect(typeof filtersResponse.tenant).toBe('string');
        expect(filtersResponse).toHaveProperty('generatedAt');
    });

    test('filters_data_has_all_arrays', () => {
        const data = filtersResponse.data;
        const arrayFields = [
            'categories', 'subCategories', 'countries', 'states',
            'deviceTypes', 'browserTypes', 'products', 'experiences'
        ];
        for (const field of arrayFields) {
            expect(Array.isArray(data[field])).toBe(true);
        }
    });

    test('filters_products_have_id_and_name', () => {
        for (const product of filtersResponse.data.products) {
            expect(typeof product.id).toBe('string');
            expect(product.id.length).toBeGreaterThan(0);
            expect(typeof product.name).toBe('string');
            expect(product.name.length).toBeGreaterThan(0);
        }
    });

    test('filters_device_types_are_strings', () => {
        for (const device of filtersResponse.data.deviceTypes) {
            expect(typeof device).toBe('string');
        }
    });

    test('filters_browser_types_are_strings', () => {
        for (const browser of filtersResponse.data.browserTypes) {
            expect(typeof browser).toBe('string');
        }
    });
});
