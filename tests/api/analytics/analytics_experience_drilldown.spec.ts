import { test, expect } from '../../../helpers/api-fixtures';
import drilldownData from '../../../fixtures/analytics_experience_drilldown.json';

let targetExperienceId: string;
let dashboardResponse: any;
let eventsResponse: any;
let summaryResponse: any;

// Real experience IDs in this system look like `experience-1777387929202`, not 24-hex
// Mongo-style. Both of these are simply non-matching filter values to the API — it does
// not perform any format validation on experienceId.
const NON_EXISTENT_EXPERIENCE_ID = '000000000000000000000000';
const MALFORMED_EXPERIENCE_ID = 'not-a-valid-id';

let dashboardNonExistentResponse: any;
let dashboardMalformedResponse: any;
let eventsNonExistentResponse: any;
let eventsMalformedResponse: any;
let summaryNonExistentResponse: any;
let summaryMalformedResponse: any;

test.beforeAll(async ({ dashboardApi }) => {
    // Must resolve first — targetExperienceId, used by the target-scoped calls below,
    // is derived from this response.
    const filtersResponse = await dashboardApi.getAnalyticsFilters();
    const targetExperience = filtersResponse.data.experiences.find(
        (exp: any) => exp.name.trim() === drilldownData.target_experience_name
    );
    targetExperienceId = targetExperience?.id;

    // The 8 calls below don't depend on each other — the non-existent/malformed-ID
    // ones use fixed constants, not targetExperienceId — so there's no reason to
    // pay for 8 sequential round trips instead of 1.
    [
        dashboardResponse,
        eventsResponse,
        summaryResponse,
        dashboardNonExistentResponse,
        dashboardMalformedResponse,
        eventsNonExistentResponse,
        eventsMalformedResponse,
        summaryNonExistentResponse,
        summaryMalformedResponse,
    ] = await Promise.all([
        dashboardApi.getAnalyticsDashboard(targetExperienceId),
        dashboardApi.getAnalyticsEvents(targetExperienceId),
        dashboardApi.getAnalyticsSummary(targetExperienceId),
        dashboardApi.getAnalyticsDashboard(NON_EXISTENT_EXPERIENCE_ID),
        dashboardApi.getAnalyticsDashboard(MALFORMED_EXPERIENCE_ID),
        dashboardApi.getAnalyticsEvents(NON_EXISTENT_EXPERIENCE_ID),
        dashboardApi.getAnalyticsEvents(MALFORMED_EXPERIENCE_ID),
        dashboardApi.getAnalyticsSummary(NON_EXISTENT_EXPERIENCE_ID),
        dashboardApi.getAnalyticsSummary(MALFORMED_EXPERIENCE_ID),
    ]);
});

test.describe('Analytics Experience Drilldown API', { tag: ['@api', '@regression'] }, () => {
    test('target experience is present in filter options', () => {
        expect(targetExperienceId).toBeTruthy();
    });

    test('dashboard_filters_echo_selected_experience_id', () => {
        expect(dashboardResponse.data.filters.experienceId).toBe(targetExperienceId);
    });

    test('dashboard_experiences_section_scoped_to_one_experience', () => {
        expect(dashboardResponse.data.experiences.totalExperiences).toBe(1);
    });

    test('dashboard_most_viewed_experiences_all_match_selected_experience', () => {
        const list = dashboardResponse.data.experiences.mostViewedExperiences;
        for (const exp of list) {
            expect(exp.experienceId).toBe(targetExperienceId);
        }
    });

    test('events_filters_applied_echo_selected_experience_id', () => {
        expect(eventsResponse.data.filters.applied.experienceId).toBe(targetExperienceId);
    });

    test('events_total_matches_events_array_length', () => {
        expect(eventsResponse.data.total).toBe(eventsResponse.data.events.length);
    });

    test('events_all_events_belong_to_selected_experience', () => {
        for (const event of eventsResponse.data.events) {
            expect(event.experienceId).toBe(targetExperienceId);
        }
    });

    test('summary_scoped_to_single_unique_experience', () => {
        expect(summaryResponse.data.summary.uniqueExperiences).toBe(1);
    });

    test('summary_experience_views_key_matches_selected_experience_id', () => {
        const views = summaryResponse.data.summary.experienceViews;
        expect(Object.keys(views)).toEqual([targetExperienceId]);
    });
});

// The API performs no format validation on experienceId at all: a syntactically
// plausible but non-existent 24-hex id and a clearly malformed string both simply
// fail to match any experience, and both return 200 with an identical zeroed/empty
// schema — there is no 400/404 branch to assert here.
test.describe('Analytics Unknown Experience ID API', { tag: ['@api', '@regression'] }, () => {
    test('dashboard_non_existent_experience_id_returns_zeroed_metrics', () => {
        expect(dashboardNonExistentResponse.success).toBe(true);
        expect(dashboardNonExistentResponse.data.overview).toEqual({ totalEvents: 0, events24h: 0 });
        expect(dashboardNonExistentResponse.data.engagement).toEqual({ totalViews: 0, totalCompletions: 0 });
        expect(dashboardNonExistentResponse.data.experiences).toEqual({
            totalExperiences: 0, activeExperiences24h: 0, mostViewedExperiences: []
        });
        expect(dashboardNonExistentResponse.data.topUsers).toEqual([]);
        expect(dashboardNonExistentResponse.data.userActivityLog).toEqual([]);
        expect(dashboardNonExistentResponse.data.timeline).toEqual([]);
    });

    test('dashboard_non_existent_experience_id_echoes_filter_in_both_locations', () => {
        expect(dashboardNonExistentResponse.data.filters.experienceId).toBe(NON_EXISTENT_EXPERIENCE_ID);
        expect(dashboardNonExistentResponse.filters.experienceId).toBe(NON_EXISTENT_EXPERIENCE_ID);
    });

    test('dashboard_malformed_experience_id_returns_zeroed_metrics', () => {
        expect(dashboardMalformedResponse.success).toBe(true);
        expect(dashboardMalformedResponse.data.overview).toEqual({ totalEvents: 0, events24h: 0 });
        expect(dashboardMalformedResponse.data.engagement).toEqual({ totalViews: 0, totalCompletions: 0 });
        expect(dashboardMalformedResponse.data.experiences).toEqual({
            totalExperiences: 0, activeExperiences24h: 0, mostViewedExperiences: []
        });
        expect(dashboardMalformedResponse.data.topUsers).toEqual([]);
        expect(dashboardMalformedResponse.data.userActivityLog).toEqual([]);
        expect(dashboardMalformedResponse.data.timeline).toEqual([]);
    });

    test('dashboard_malformed_experience_id_echoes_filter_in_both_locations', () => {
        expect(dashboardMalformedResponse.data.filters.experienceId).toBe(MALFORMED_EXPERIENCE_ID);
        expect(dashboardMalformedResponse.filters.experienceId).toBe(MALFORMED_EXPERIENCE_ID);
    });

    test('events_non_existent_experience_id_returns_empty_events_and_zeroed_summary', () => {
        expect(eventsNonExistentResponse.success).toBe(true);
        expect(eventsNonExistentResponse.data.events).toEqual([]);
        expect(eventsNonExistentResponse.data.total).toBe(0);
        expect(eventsNonExistentResponse.data.summary.eventTypes).toEqual({});
        expect(eventsNonExistentResponse.data.summary.experienceViews).toEqual({});
        expect(eventsNonExistentResponse.data.summary.hotspotInteractions).toEqual({});
        expect(eventsNonExistentResponse.data.summary.dateRange).toEqual({ earliestEvent: null, latestEvent: null });
    });

    test('events_non_existent_experience_id_echoes_filter', () => {
        expect(eventsNonExistentResponse.data.filters.applied.experienceId).toBe(NON_EXISTENT_EXPERIENCE_ID);
    });

    test('events_malformed_experience_id_returns_empty_events_and_zeroed_summary', () => {
        expect(eventsMalformedResponse.success).toBe(true);
        expect(eventsMalformedResponse.data.events).toEqual([]);
        expect(eventsMalformedResponse.data.total).toBe(0);
        expect(eventsMalformedResponse.data.summary.eventTypes).toEqual({});
        expect(eventsMalformedResponse.data.summary.experienceViews).toEqual({});
        expect(eventsMalformedResponse.data.summary.hotspotInteractions).toEqual({});
        expect(eventsMalformedResponse.data.summary.dateRange).toEqual({ earliestEvent: null, latestEvent: null });
    });

    test('events_malformed_experience_id_echoes_filter', () => {
        expect(eventsMalformedResponse.data.filters.applied.experienceId).toBe(MALFORMED_EXPERIENCE_ID);
    });

    test('summary_non_existent_experience_id_returns_zeroed_shape', () => {
        expect(summaryNonExistentResponse.success).toBe(true);
        expect(summaryNonExistentResponse.data.summary.eventTypes).toEqual({});
        expect(summaryNonExistentResponse.data.summary.experienceViews).toEqual({});
        expect(summaryNonExistentResponse.data.summary.hotspotInteractions).toEqual({});
        expect(summaryNonExistentResponse.data.summary.dateRange).toEqual({ earliestEvent: null, latestEvent: null });
    });

    test('summary_non_existent_experience_id_echoes_filter', () => {
        expect(summaryNonExistentResponse.filters.experienceId).toBe(NON_EXISTENT_EXPERIENCE_ID);
    });

    test('summary_malformed_experience_id_returns_zeroed_shape', () => {
        expect(summaryMalformedResponse.success).toBe(true);
        expect(summaryMalformedResponse.data.summary.eventTypes).toEqual({});
        expect(summaryMalformedResponse.data.summary.experienceViews).toEqual({});
        expect(summaryMalformedResponse.data.summary.hotspotInteractions).toEqual({});
        expect(summaryMalformedResponse.data.summary.dateRange).toEqual({ earliestEvent: null, latestEvent: null });
    });

    test('summary_malformed_experience_id_echoes_filter', () => {
        expect(summaryMalformedResponse.filters.experienceId).toBe(MALFORMED_EXPERIENCE_ID);
    });
});
