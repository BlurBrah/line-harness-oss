import type { HttpClient } from '../http.js'
import type { ApiResponse } from '../types.js'

export interface MetaAction {
  action_type: string
  value: string
}

export interface AdInsightRow {
  campaign_name?: string
  adset_name?: string
  ad_name?: string
  age?: string
  impressions: string
  clicks: string
  spend: string
  reach?: string
  cpc?: string
  cpm?: string
  ctr?: string
  actions?: MetaAction[]
  cost_per_action_type?: MetaAction[]
}

export interface AdInsightsResponse {
  data: AdInsightRow[]
  paging?: Record<string, unknown>
}

export interface AdInsightsQuery {
  datePreset?: string
  since?: string
  until?: string
  level?: string
}

export class AdInsightsResource {
  constructor(private readonly http: HttpClient) {}

  async summary(query?: AdInsightsQuery): Promise<AdInsightsResponse> {
    const q = this.buildQuery(query)
    const res = await this.http.get<ApiResponse<AdInsightsResponse>>(`/api/ad-insights/summary?${q}`)
    return res.data
  }

  async campaigns(query?: AdInsightsQuery): Promise<AdInsightsResponse> {
    const q = this.buildQuery(query)
    if (query?.level) q.set('level', query.level)
    const res = await this.http.get<ApiResponse<AdInsightsResponse>>(`/api/ad-insights?${q}`)
    return res.data
  }

  async age(query?: AdInsightsQuery): Promise<AdInsightsResponse> {
    const q = this.buildQuery(query)
    const res = await this.http.get<ApiResponse<AdInsightsResponse>>(`/api/ad-insights/age?${q}`)
    return res.data
  }

  private buildQuery(query?: AdInsightsQuery): URLSearchParams {
    const q = new URLSearchParams()
    if (query?.datePreset) q.set('datePreset', query.datePreset)
    if (query?.since) q.set('since', query.since)
    if (query?.until) q.set('until', query.until)
    return q
  }
}
