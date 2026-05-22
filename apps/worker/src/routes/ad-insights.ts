import { Hono } from 'hono';
import { getAdPlatformByName, type AdPlatformConfig } from '@line-crm/db';
import type { Env } from '../index.js';

const adInsights = new Hono<Env>();

async function fetchMetaInsights(
  config: AdPlatformConfig,
  opts: {
    fields: string;
    datePreset?: string;
    since?: string;
    until?: string;
    level?: string;
    breakdowns?: string;
  },
): Promise<{ ok: boolean; body: Record<string, unknown> }> {
  const accountId = config.ad_account_id!.startsWith('act_')
    ? config.ad_account_id!
    : `act_${config.ad_account_id!}`;

  const params = new URLSearchParams({
    fields: opts.fields,
    access_token: config.access_token!,
  });

  if (opts.level) params.set('level', opts.level);
  if (opts.breakdowns) params.set('breakdowns', opts.breakdowns);

  if (opts.since && opts.until) {
    params.set('time_range', JSON.stringify({ since: opts.since, until: opts.until }));
  } else {
    params.set('date_preset', opts.datePreset ?? 'last_30d');
  }

  const url = `https://graph.facebook.com/v21.0/${accountId}/insights?${params.toString()}`;
  const res = await fetch(url);
  const body = await res.json() as Record<string, unknown>;
  return { ok: res.ok, body };
}

async function resolveMetaConfig(db: D1Database): Promise<
  | { config: AdPlatformConfig }
  | { error: string; status: 400 | 404 }
> {
  const platform = await getAdPlatformByName(db, 'meta');
  if (!platform) return { error: 'Meta platform not configured or inactive', status: 404 };
  const config: AdPlatformConfig = JSON.parse(platform.config);
  if (!config.access_token || !config.ad_account_id) {
    return { error: 'Meta platform missing access_token or ad_account_id', status: 400 };
  }
  return { config };
}

// GET /api/ad-insights?datePreset=last_30d&level=campaign
adInsights.get('/api/ad-insights', async (c) => {
  const result = await resolveMetaConfig(c.env.DB);
  if ('error' in result) return c.json({ success: false, error: result.error }, result.status);

  const fields = 'campaign_name,adset_name,ad_name,impressions,clicks,spend,actions,cost_per_action_type,cpc,cpm,ctr,reach';

  try {
    const { ok, body } = await fetchMetaInsights(result.config, {
      fields,
      datePreset: c.req.query('datePreset') ?? 'last_30d',
      since: c.req.query('since'),
      until: c.req.query('until'),
      level: c.req.query('level') ?? 'campaign',
    });

    if (!ok) {
      console.error('Meta Insights API error:', JSON.stringify(body));
      return c.json({ success: false, error: 'Meta API error', detail: body }, 502);
    }
    return c.json({ success: true, data: body });
  } catch (err) {
    console.error('GET /api/ad-insights error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// GET /api/ad-insights/summary
adInsights.get('/api/ad-insights/summary', async (c) => {
  const result = await resolveMetaConfig(c.env.DB);
  if ('error' in result) return c.json({ success: false, error: result.error }, result.status);

  try {
    const { ok, body } = await fetchMetaInsights(result.config, {
      fields: 'impressions,clicks,spend,reach,actions,cost_per_action_type,cpc,cpm,ctr',
      datePreset: c.req.query('datePreset') ?? 'last_30d',
      since: c.req.query('since'),
      until: c.req.query('until'),
    });

    if (!ok) {
      console.error('Meta Insights API error:', JSON.stringify(body));
      return c.json({ success: false, error: 'Meta API error', detail: body }, 502);
    }
    return c.json({ success: true, data: body });
  } catch (err) {
    console.error('GET /api/ad-insights/summary error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// GET /api/ad-insights/age — age breakdown
adInsights.get('/api/ad-insights/age', async (c) => {
  const result = await resolveMetaConfig(c.env.DB);
  if ('error' in result) return c.json({ success: false, error: result.error }, result.status);

  try {
    const { ok, body } = await fetchMetaInsights(result.config, {
      fields: 'impressions,clicks,spend,actions,cost_per_action_type,cpc,cpm,ctr',
      datePreset: c.req.query('datePreset') ?? 'last_30d',
      since: c.req.query('since'),
      until: c.req.query('until'),
      breakdowns: 'age',
    });

    if (!ok) {
      console.error('Meta Insights API error:', JSON.stringify(body));
      return c.json({ success: false, error: 'Meta API error', detail: body }, 502);
    }
    return c.json({ success: true, data: body });
  } catch (err) {
    console.error('GET /api/ad-insights/age error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

export { adInsights };
