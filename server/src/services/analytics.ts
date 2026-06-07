import type { AnalyticsEventInput } from "../schemas/analytics.js";
import { query } from "./postgres.js";

let tableReady: Promise<void> | null = null;

async function ensureAnalyticsTable() {
  tableReady ??= query(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID NOT NULL,
      event_name TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS analytics_events_event_name_idx
      ON analytics_events (event_name);

    CREATE INDEX IF NOT EXISTS analytics_events_user_created_idx
      ON analytics_events (user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx
      ON analytics_events (created_at DESC);
  `).then(() => undefined);

  return tableReady;
}

export async function recordAnalyticsEvent(input: AnalyticsEventInput) {
  await ensureAnalyticsTable();
  await query(
    `
      INSERT INTO analytics_events (user_id, event_name, metadata)
      VALUES ($1, $2, $3::jsonb)
    `,
    [input.user_id, input.event_name, JSON.stringify(input.metadata || {})]
  );

  return { success: true as const };
}

export async function getAnalyticsSummary() {
  await ensureAnalyticsTable();
  const result = await query<{
    installs: string;
    firststashusers: string;
    notionconnectedusers: string;
    totalstashes: string;
    totalalltabsactions: string;
    totalnotionsyncs: string;
    dau: string;
    wau: string;
  }>(`
    SELECT
      COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'extension_installed') AS installs,
      COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'first_stash') AS firstStashUsers,
      COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'notion_connected') AS notionConnectedUsers,
      COALESCE(SUM(
        CASE
          WHEN event_name = 'stash_tab' THEN 1
          WHEN event_name = 'stash_all_tabs' THEN GREATEST(COALESCE((metadata->>'tab_count')::int, 0), 0)
          ELSE 0
        END
      ), 0) AS totalStashes,
      COUNT(*) FILTER (WHERE event_name = 'stash_all_tabs') AS totalAllTabsActions,
      COUNT(*) FILTER (WHERE event_name = 'notion_sync_success') AS totalNotionSyncs,
      COUNT(DISTINCT user_id) FILTER (WHERE created_at >= CURRENT_DATE) AS dau,
      COUNT(DISTINCT user_id) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '6 days') AS wau
    FROM analytics_events
  `);

  const row = result.rows[0];
  return {
    installs: Number(row.installs || 0),
    firstStashUsers: Number(row.firststashusers || 0),
    notionConnectedUsers: Number(row.notionconnectedusers || 0),
    totalStashes: Number(row.totalstashes || 0),
    totalAllTabsActions: Number(row.totalalltabsactions || 0),
    totalNotionSyncs: Number(row.totalnotionsyncs || 0),
    dau: Number(row.dau || 0),
    wau: Number(row.wau || 0)
  };
}
