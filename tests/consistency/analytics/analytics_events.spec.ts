import { test, expect } from '../../../helpers/api-fixtures';

test.describe('Analytics Events Consistency', { tag: ['@consistency', '@regression'] }, () => {
  let eventsResponse: any;
  let summaryResponse: any;
  let portfolioResponse: any;

  test.beforeAll(async ({ dashboardApi }) => {
    // The three fetches below are fast on their own (a few seconds combined, verified
    // live) — the real cost in this file was events_every_row_has_required_fields
    // looping expect() per field per row over 10k+ events (~99s from matcher overhead
    // alone, fixed to a single aggregate assertion). This timeout is generous headroom
    // for a slower day on the live backend, not a reflection of the typical cost.
    test.setTimeout(120000);
    eventsResponse = await dashboardApi.getAnalyticsEvents();
    summaryResponse = await dashboardApi.getAnalyticsSummary();
    portfolioResponse = await dashboardApi.getAnalyticsPortfolio();
  });

  test.describe('Events API schema', () => {
    test('events_top_level_schema_is_valid', () => {
      expect(eventsResponse.success).toBe(true);
      expect(eventsResponse).toHaveProperty('data');
      expect(typeof eventsResponse.tenant).toBe('string');
      expect(typeof eventsResponse.generatedAt).toBe('string');
      expect(Array.isArray(eventsResponse.data.events)).toBe(true);
      expect(typeof eventsResponse.data.total).toBe('number');
      expect(eventsResponse.data).toHaveProperty('summary');
      expect(eventsResponse.data).toHaveProperty('filters');
    });

    test('events_every_row_has_required_fields', () => {
      // One expect() per field per row (10k+ events live) took ~99s from Playwright's
      // per-assertion overhead alone, not the actual checks. Collapse to a single
      // assertion over the whole array — still checks every row, just without paying
      // matcher overhead 10,000+ times. Same pattern the sibling tests below already use.
      const isValid = (event: any) =>
        typeof event._id === 'string' &&
        typeof event.type === 'string' &&
        typeof event.experienceId === 'string' &&
        // experienceName is null for events whose experience has since been deleted/renamed.
        ['string', 'object'].includes(typeof event.experienceName) &&
        typeof event.timestamp === 'string' &&
        !Number.isNaN(new Date(event.timestamp).getTime()) &&
        typeof event.properties === 'object';

      const invalid = eventsResponse.data.events.filter((event: any) => !isValid(event));
      expect(invalid).toEqual([]);
    });

    test('events_summary_schema_is_valid', () => {
      const summary = eventsResponse.data.summary;
      expect(typeof summary.totalEvents).toBe('number');
      expect(typeof summary.uniqueExperiences).toBe('number');
      expect(typeof summary.uniqueUsers).toBe('number');
      expect(typeof summary.uniqueSessions).toBe('number');
      expect(typeof summary.eventTypes).toBe('object');
      expect(typeof summary.experienceViews).toBe('object');
      expect(typeof summary.hotspotInteractions).toBe('object');
      expect(typeof summary.dateRange.earliestEvent).toBe('string');
      expect(typeof summary.dateRange.latestEvent).toBe('string');
    });
  });

  test.describe('Events internal consistency', () => {
    test('events_array_length_matches_total', () => {
      expect(eventsResponse.data.events.length).toBe(eventsResponse.data.total);
    });

    test('total_matches_summary_totalEvents', () => {
      expect(eventsResponse.data.total).toBe(eventsResponse.data.summary.totalEvents);
    });

    test('eventTypes_counts_sum_to_total', () => {
      const summary = eventsResponse.data.summary;
      const sum = Object.values(summary.eventTypes as Record<string, number>).reduce((a, b) => a + b, 0);
      expect(sum).toBe(summary.totalEvents);
    });

    test('eventTypes_counts_match_actual_event_rows_per_type', () => {
      const { events, summary } = eventsResponse.data;
      for (const [type, expectedCount] of Object.entries(summary.eventTypes as Record<string, number>)) {
        const actualCount = events.filter((e: any) => e.type === type).length;
        expect(actualCount).toBe(expectedCount);
      }
    });

    test('every_event_type_present_in_rows_is_accounted_for_in_eventTypes', () => {
      // Guards against the server introducing a new event `type` that the summary aggregation doesn't bucket.
      const { events, summary } = eventsResponse.data;
      const typesInRows = new Set<string>(events.map((e: any) => e.type));
      const typesInSummary = new Set(Object.keys(summary.eventTypes));
      for (const type of typesInRows) {
        expect(typesInSummary.has(type)).toBe(true);
      }
    });

    test('uniqueExperiences_matches_distinct_experienceIds_in_rows', () => {
      const { events, summary } = eventsResponse.data;
      const distinctExperienceIds = new Set(events.map((e: any) => e.experienceId));
      expect(distinctExperienceIds.size).toBe(summary.uniqueExperiences);
    });

    test('uniqueSessions_matches_distinct_sessionIds_in_rows', () => {
      const { events, summary } = eventsResponse.data;
      const distinctSessionIds = new Set(events.map((e: any) => e.sessionId).filter(Boolean));
      expect(distinctSessionIds.size).toBe(summary.uniqueSessions);
    });

    test('uniqueUsers_matches_distinct_userId_or_anonymousId_in_rows', () => {
      const { events, summary } = eventsResponse.data;
      const distinctViewers = new Set(events.map((e: any) => e.userId || e.anonymousId).filter(Boolean));
      expect(distinctViewers.size).toBe(summary.uniqueUsers);
    });

    test('experienceViews_values_sum_to_experience_viewed_count', () => {
      const { events, summary } = eventsResponse.data;
      const sum = Object.values(summary.experienceViews as Record<string, number>).reduce((a, b) => a + b, 0);
      const viewedCount = events.filter((e: any) => e.type === 'experience_viewed').length;
      expect(sum).toBe(viewedCount);
    });

    test('hotspotInteractions_values_sum_to_hotspot_clicked_count', () => {
      const { events, summary } = eventsResponse.data;
      const sum = Object.values(summary.hotspotInteractions as Record<string, number>).reduce((a, b) => a + b, 0);
      const clickedCount = events.filter((e: any) => e.type === 'hotspot_clicked').length;
      expect(sum).toBe(clickedCount);
    });

    test('dateRange_earliestEvent_matches_min_row_timestamp', () => {
      const { events, summary } = eventsResponse.data;
      const minTimestamp = Math.min(...events.map((e: any) => new Date(e.timestamp).getTime()));
      expect(new Date(summary.dateRange.earliestEvent).getTime()).toBe(minTimestamp);
    });

    test('dateRange_latestEvent_matches_max_row_timestamp', () => {
      const { events, summary } = eventsResponse.data;
      const maxTimestamp = Math.max(...events.map((e: any) => new Date(e.timestamp).getTime()));
      expect(new Date(summary.dateRange.latestEvent).getTime()).toBe(maxTimestamp);
    });
  });

  test.describe('Events vs other analytics endpoints', () => {
    test('summary_endpoint_matches_events_endpoint_summary', () => {
      // /summary and /events compute the same aggregation independently — they must agree.
      expect(summaryResponse.data.summary).toEqual(eventsResponse.data.summary);
    });

    test('portfolio_totalEvents_matches_events_total', () => {
      expect(portfolioResponse.data.overview.totalEvents).toBe(eventsResponse.data.total);
    });

    test('portfolio_totalUsers_matches_events_uniqueUsers', () => {
      expect(portfolioResponse.data.overview.totalUsers).toBe(eventsResponse.data.summary.uniqueUsers);
    });

    test('portfolio_totalSessions_matches_events_uniqueSessions', () => {
      expect(portfolioResponse.data.overview.totalSessions).toBe(eventsResponse.data.summary.uniqueSessions);
    });

    test('portfolio_totalViews_matches_events_experience_viewed_count', () => {
      expect(portfolioResponse.data.overview.totalViews).toBe(
        eventsResponse.data.summary.eventTypes.experience_viewed ?? 0
      );
    });

    test('portfolio_totalCompletions_matches_events_experience_completed_count', () => {
      expect(portfolioResponse.data.overview.totalCompletions).toBe(
        eventsResponse.data.summary.eventTypes.experience_completed ?? 0
      );
    });
  });
});
