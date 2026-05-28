'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import Header from '@/components/layout/header'
import { useAccount } from '@/contexts/account-context'

// Date range is always custom (since/until)

interface MetaAction {
  action_type: string
  value: string
}

interface MetaRow {
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

interface ConversionReport {
  conversionPointId: string
  conversionPointName: string
  eventType: string
  totalCount: number
  totalValue: number
}

interface TokenStatus {
  isValid: boolean
  type: string | null
  expiresAt: number | null
  dataAccessExpiresAt: number | null
}

const JPY_RATE = 150

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function monthStart(offset: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + offset, 1)
  return toYMD(d)
}

function monthEnd(offset: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + offset + 1, 0)
  return toYMD(d)
}

const QUICK_RANGES: { label: string; since: string; until: string }[] = [
  { label: '今月', since: monthStart(0), until: toYMD(new Date()) },
  { label: '先月', since: monthStart(-1), until: monthEnd(-1) },
  { label: '過去3ヶ月', since: monthStart(-2), until: toYMD(new Date()) },
  { label: '過去6ヶ月', since: monthStart(-5), until: toYMD(new Date()) },
  { label: '過去1年', since: monthStart(-11), until: toYMD(new Date()) },
  { label: '2024年全体', since: '2024-01-01', until: '2024-12-31' },
  { label: '2025年全体', since: '2025-01-01', until: toYMD(new Date()) },
  { label: '全期間 (2024/1〜)', since: '2024-01-01', until: toYMD(new Date()) },
]

function getActionValue(actions: MetaAction[] | undefined, type: string): number {
  if (!actions) return 0
  const action = actions.find((a) => a.action_type === type)
  return action ? parseInt(action.value, 10) : 0
}

function fmtNum(n: number): string {
  return n.toLocaleString()
}

function fmtJpy(usd: number): string {
  return `¥${Math.round(usd * JPY_RATE).toLocaleString()}`
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`
}

function fmtPct(n: number): string {
  if (!isFinite(n)) return '-'
  return `${n.toFixed(1)}%`
}

function fmtCpa(spend: number, count: number): string {
  if (count === 0) return '-'
  return fmtJpy(spend / count)
}

function FunnelStep({ label, count, cpa, rate, color }: {
  label: string
  count: number
  cpa: string
  rate?: string
  color: string
}) {
  return (
    <div className="flex-1 min-w-[140px]">
      <div className="text-center">
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        <p className="text-2xl font-bold" style={{ color }}>{fmtNum(count)}</p>
        <p className="text-xs text-gray-400 mt-1">CPA {cpa}</p>
        {rate && <p className="text-xs text-gray-400">率 {rate}</p>}
      </div>
    </div>
  )
}

function FunnelArrow() {
  return (
    <div className="flex items-center justify-center px-1">
      <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  )
}

// Sort state: null = default, 'asc', 'desc'
type SortDir = 'asc' | 'desc' | null
type SortState = { key: string; dir: SortDir }

function useSortState() {
  const [sort, setSort] = useState<SortState>({ key: '', dir: null })
  const toggle = (key: string) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      if (prev.dir === 'desc') return { key: '', dir: null }
      return { key, dir: 'asc' }
    })
  }
  return { sort, toggle }
}

function SortIcon({ dir }: { dir: SortDir }) {
  if (dir === 'asc') return <span className="ml-1 text-green-600">↑</span>
  if (dir === 'desc') return <span className="ml-1 text-green-600">↓</span>
  return <span className="ml-1 text-gray-300">↕</span>
}

function SortTh({ label, sortKey, sort, toggle, align = 'right' }: {
  label: string; sortKey: string; sort: SortState; toggle: (k: string) => void; align?: 'left' | 'right'
}) {
  return (
    <th
      className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer select-none hover:bg-gray-100 ${align === 'left' ? 'text-left' : 'text-right'}`}
      onClick={() => toggle(sortKey)}
    >
      {label}<SortIcon dir={sort.key === sortKey ? sort.dir : null} />
    </th>
  )
}

type MetaRowWithDerived = MetaRow & { _spend: number; _clicks: number; _purchase: number; _cpc: number; _cpa: number }

function deriveRow(row: MetaRow): MetaRowWithDerived {
  const s = parseFloat(row.spend)
  const c = parseInt(row.clicks)
  const p = getActionValue(row.actions, 'purchase')
  return { ...row, _spend: s, _clicks: c, _purchase: p, _cpc: c > 0 ? s / c : Infinity, _cpa: p > 0 ? s / p : Infinity }
}

function sortRows(rows: MetaRowWithDerived[], sort: SortState, nameKey: string): MetaRowWithDerived[] {
  if (!sort.dir || !sort.key) return rows
  const sorted = [...rows]
  const dir = sort.dir === 'asc' ? 1 : -1
  sorted.sort((a, b) => {
    let va: number | string, vb: number | string
    switch (sort.key) {
      case 'name': va = (a as unknown as Record<string, string>)[nameKey] || ''; vb = (b as unknown as Record<string, string>)[nameKey] || ''; return va < vb ? -dir : va > vb ? dir : 0
      case 'imp': va = parseInt(a.impressions); vb = parseInt(b.impressions); break
      case 'clicks': va = a._clicks; vb = b._clicks; break
      case 'spend': va = a._spend; vb = b._spend; break
      case 'cpc': va = a._cpc; vb = b._cpc; break
      case 'ctr': va = parseFloat(a.ctr || '0'); vb = parseFloat(b.ctr || '0'); break
      case 'purchase': va = a._purchase; vb = b._purchase; break
      case 'cpa': va = a._cpa; vb = b._cpa; break
      default: return 0
    }
    return (va - vb) * dir
  })
  return sorted
}

function MetaTable({ title, rows, nameKey }: { title: string; rows: MetaRow[]; nameKey: 'campaign_name' | 'adset_name' | 'ad_name' }) {
  const label = nameKey === 'campaign_name' ? 'キャンペーン' : nameKey === 'adset_name' ? '広告セット' : '広告'
  const { sort, toggle } = useSortState()

  if (rows.length === 0) {
    return (
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">{title}</h2>
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">データがありません</div>
      </div>
    )
  }

  const derived = rows.map(deriveRow)
  const sorted = sortRows(derived, sort, nameKey)

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">{title}</h2>
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <SortTh label={label} sortKey="name" sort={sort} toggle={toggle} align="left" />
              <SortTh label="Imp" sortKey="imp" sort={sort} toggle={toggle} />
              <SortTh label="クリック" sortKey="clicks" sort={sort} toggle={toggle} />
              <SortTh label="費用 (円)" sortKey="spend" sort={sort} toggle={toggle} />
              <SortTh label="CPC (円)" sortKey="cpc" sort={sort} toggle={toggle} />
              <SortTh label="CTR" sortKey="ctr" sort={sort} toggle={toggle} />
              <SortTh label="Purchase" sortKey="purchase" sort={sort} toggle={toggle} />
              <SortTh label="CPA (円)" sortKey="cpa" sort={sort} toggle={toggle} />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sorted.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[300px] truncate">{row[nameKey] || '-'}</td>
                <td className="px-4 py-3 text-sm text-right text-gray-600 tabular-nums">{fmtNum(parseInt(row.impressions))}</td>
                <td className="px-4 py-3 text-sm text-right text-gray-600 tabular-nums">{fmtNum(row._clicks)}</td>
                <td className="px-4 py-3 text-sm text-right text-gray-600 tabular-nums">{fmtJpy(row._spend)}</td>
                <td className="px-4 py-3 text-sm text-right text-gray-600 tabular-nums">{row._clicks > 0 ? fmtJpy(row._spend / row._clicks) : '-'}</td>
                <td className="px-4 py-3 text-sm text-right text-gray-600 tabular-nums">{row.ctr ? fmtPct(parseFloat(row.ctr)) : '-'}</td>
                <td className="px-4 py-3 text-sm text-right font-medium text-purple-600 tabular-nums">{row._purchase || '-'}</td>
                <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 tabular-nums">{fmtCpa(row._spend, row._purchase)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AgeTable({ rows }: { rows: MetaRow[] }) {
  const { sort, toggle } = useSortState()
  const derived = rows.map((row) => {
    const d = deriveRow(row)
    return { ...d, _cvr: d._clicks > 0 ? d._purchase / d._clicks * 100 : 0 }
  })

  const sorted = [...derived]
  if (sort.dir && sort.key) {
    const dir = sort.dir === 'asc' ? 1 : -1
    sorted.sort((a, b) => {
      let va: number | string, vb: number | string
      switch (sort.key) {
        case 'name': va = a.age || ''; vb = b.age || ''; return va < vb ? -dir : va > vb ? dir : 0
        case 'imp': va = parseInt(a.impressions); vb = parseInt(b.impressions); break
        case 'clicks': va = a._clicks; vb = b._clicks; break
        case 'ctr': va = parseFloat(a.ctr || '0'); vb = parseFloat(b.ctr || '0'); break
        case 'spend': va = a._spend; vb = b._spend; break
        case 'cpc': va = a._cpc; vb = b._cpc; break
        case 'purchase': va = a._purchase; vb = b._purchase; break
        case 'cvr': va = a._cvr; vb = b._cvr; break
        case 'cpa': va = a._cpa; vb = b._cpa; break
        default: return 0
      }
      return (va - vb) * dir
    })
  }

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">年齢別パフォーマンス</h2>
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <SortTh label="年齢" sortKey="name" sort={sort} toggle={toggle} align="left" />
              <SortTh label="Imp" sortKey="imp" sort={sort} toggle={toggle} />
              <SortTh label="クリック" sortKey="clicks" sort={sort} toggle={toggle} />
              <SortTh label="CTR" sortKey="ctr" sort={sort} toggle={toggle} />
              <SortTh label="費用 (円)" sortKey="spend" sort={sort} toggle={toggle} />
              <SortTh label="CPC (円)" sortKey="cpc" sort={sort} toggle={toggle} />
              <SortTh label="Purchase" sortKey="purchase" sort={sort} toggle={toggle} />
              <SortTh label="CVR" sortKey="cvr" sort={sort} toggle={toggle} />
              <SortTh label="CPA (円)" sortKey="cpa" sort={sort} toggle={toggle} />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sorted.map((row) => (
              <tr key={row.age} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.age}</td>
                <td className="px-4 py-3 text-sm text-right text-gray-600 tabular-nums">{fmtNum(parseInt(row.impressions))}</td>
                <td className="px-4 py-3 text-sm text-right text-gray-600 tabular-nums">{fmtNum(row._clicks)}</td>
                <td className="px-4 py-3 text-sm text-right text-gray-600 tabular-nums">{fmtPct(parseFloat(row.ctr || '0'))}</td>
                <td className="px-4 py-3 text-sm text-right text-gray-600 tabular-nums">{fmtJpy(row._spend)}</td>
                <td className="px-4 py-3 text-sm text-right text-gray-600 tabular-nums">{row._clicks > 0 ? fmtJpy(row._spend / row._clicks) : '-'}</td>
                <td className="px-4 py-3 text-sm text-right font-medium text-purple-600 tabular-nums">{row._purchase || '-'}</td>
                <td className="px-4 py-3 text-sm text-right text-gray-600 tabular-nums">{row._clicks > 0 ? fmtPct(row._cvr) : '-'}</td>
                <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 tabular-nums">{fmtCpa(row._spend, row._purchase)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AdInsightsPage() {
  const { selectedAccountId } = useAccount()
  const [since, setSince] = useState(monthStart(0))
  const [until, setUntil] = useState(toYMD(new Date()))
  const [summary, setSummary] = useState<MetaRow | null>(null)
  const [campaigns, setCampaigns] = useState<MetaRow[]>([])
  const [adsets, setAdsets] = useState<MetaRow[]>([])
  const [ads, setAds] = useState<MetaRow[]>([])
  const [ageRows, setAgeRows] = useState<MetaRow[]>([])
  const [cvReport, setCvReport] = useState<ConversionReport[]>([])
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const queryParams = { since, until }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Scope LINE Harness conversion counts to the currently selected LINE
      // Official Account so test accounts (e.g. watashino-test) don't bleed
      // into the production account's ad-report funnel. Meta-side metrics
      // (impressions/clicks/spend) are intentionally not scoped — the Meta
      // ad account is shared across LINE accounts in this org.
      const cvParams: { startDate: string; endDate: string; lineAccountId?: string } = {
        startDate: since,
        endDate: until + 'T23:59:59',
      }
      if (selectedAccountId) cvParams.lineAccountId = selectedAccountId

      const [sumRes, campRes, adsetRes, adRes, ageRes, cvRes] = await Promise.allSettled([
        api.adInsights.summary(queryParams),
        api.adInsights.campaigns({ ...queryParams, level: 'campaign' }),
        api.adInsights.campaigns({ ...queryParams, level: 'adset' }),
        api.adInsights.campaigns({ ...queryParams, level: 'ad' }),
        api.adInsights.age(queryParams),
        api.conversions.report(cvParams),
      ])

      if (sumRes.status === 'fulfilled' && sumRes.value.success) {
        const rows = (sumRes.value.data as unknown as { data: MetaRow[] }).data
        setSummary(rows?.length > 0 ? rows[0] : null)
      } else if (sumRes.status === 'rejected') {
        setError(sumRes.reason?.message || 'Failed to load')
      }

      if (campRes.status === 'fulfilled' && campRes.value.success) {
        setCampaigns((campRes.value.data as unknown as { data: MetaRow[] }).data || [])
      }
      if (adsetRes.status === 'fulfilled' && adsetRes.value.success) {
        setAdsets((adsetRes.value.data as unknown as { data: MetaRow[] }).data || [])
      }
      if (adRes.status === 'fulfilled' && adRes.value.success) {
        setAds((adRes.value.data as unknown as { data: MetaRow[] }).data || [])
      }

      if (ageRes.status === 'fulfilled' && ageRes.value.success) {
        setAgeRows((ageRes.value.data as unknown as { data: MetaRow[] }).data || [])
      }

      if (cvRes.status === 'fulfilled' && cvRes.value.success) {
        setCvReport(cvRes.value.data as unknown as ConversionReport[])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    }
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [since, until, selectedAccountId])

  useEffect(() => { load() }, [load])

  // Token expiry is independent of the date range, so fetch it once on mount.
  useEffect(() => {
    api.adInsights.tokenStatus()
      .then((res) => { if (res.success && res.data) setTokenStatus(res.data) })
      .catch(() => { /* badge stays hidden on failure */ })
  }, [])

  // Derive funnel numbers
  const spend = summary ? parseFloat(summary.spend) : 0
  const spendJpy = spend * JPY_RATE
  const impressions = summary ? parseInt(summary.impressions) : 0
  const clicks = summary ? parseInt(summary.clicks) : 0
  const purchase = summary ? getActionValue(summary.actions, 'purchase') : 0
  const lineAdds = cvReport.find((c) => c.eventType === 'Lead')?.totalCount ?? 0
  const reservations = cvReport.find((c) => c.eventType === 'CompleteRegistration')?.totalCount ?? 0
  const initiateCheckout = cvReport.find((c) => c.eventType === 'InitiateCheckout')?.totalCount ?? 0

  return (
    <div>
      <Header
        title="広告パフォーマンス"
        description="Meta広告 + LINE Harness ファネル統合ダッシュボード"
        action={<TokenStatusBadge status={tokenStatus} />}
      />

      {/* Date range controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              min="2024-01-01"
            />
            <span className="text-gray-400">〜</span>
            <input
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              min="2024-01-01"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {QUICK_RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => { setSince(r.since); setUntil(r.until) }}
                className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                  since === r.since && until === r.until
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">読み込み中...</div>
      ) : (
        <>
          {/* ===== Funnel View ===== */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">ファネル</h2>
            <div className="flex items-center overflow-x-auto gap-1">
              <FunnelStep label="広告費" count={Math.round(spendJpy)} cpa="-" color="#374151" />
              <FunnelArrow />
              <FunnelStep label="インプレッション" count={impressions} cpa={fmtJpy(spend / Math.max(impressions, 1) * 1000)} rate="CPM" color="#6B7280" />
              <FunnelArrow />
              <FunnelStep label="クリック" count={clicks} cpa={fmtJpy(spend / Math.max(clicks, 1))} rate={fmtPct(clicks / Math.max(impressions, 1) * 100)} color="#3B82F6" />
              <FunnelArrow />
              <FunnelStep label="Purchase (Pixel)" count={purchase} cpa={fmtCpa(spend, purchase)} rate={fmtPct(purchase / Math.max(clicks, 1) * 100)} color="#8B5CF6" />
              <FunnelArrow />
              <FunnelStep label="LINE追加" count={lineAdds} cpa={fmtCpa(spend, lineAdds)} rate={purchase > 0 ? fmtPct(lineAdds / purchase * 100) : '-'} color="#06C755" />
              <FunnelArrow />
              <FunnelStep label="予約ページ遷移" count={initiateCheckout} cpa={fmtCpa(spend, initiateCheckout)} rate={lineAdds > 0 ? fmtPct(initiateCheckout / lineAdds * 100) : '-'} color="#F59E0B" />
              <FunnelArrow />
              <FunnelStep label="予約完了" count={reservations} cpa={fmtCpa(spend, reservations)} rate={lineAdds > 0 ? fmtPct(reservations / lineAdds * 100) : '-'} color="#EF4444" />
            </div>
          </div>

          {/* ===== KPI Cards ===== */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 mb-6">
              <KpiCard label="広告費 (円)" value={fmtJpy(spend)} sub={fmtUsd(spend)} />
              <KpiCard label="インプレッション" value={fmtNum(impressions)} />
              <KpiCard label="クリック" value={fmtNum(clicks)} sub={`CTR ${fmtPct(parseFloat(summary.ctr || '0'))}`} />
              <KpiCard label="CPC (円)" value={fmtJpy(parseFloat(summary.cpc || '0'))} sub={fmtUsd(parseFloat(summary.cpc || '0'))} />
              <KpiCard label="Purchase" value={fmtNum(purchase)} sub={`CPA ${fmtCpa(spend, purchase)}`} />
              <KpiCard
                label="Purchase→LINE登録"
                value={purchase > 0 ? fmtPct(lineAdds / purchase * 100) : '-'}
                sub={`${fmtNum(lineAdds)} / ${fmtNum(purchase)}`}
              />
              <KpiCard label="LINE登録CPA (円)" value={fmtCpa(spend, lineAdds)} sub={`LINE追加 ${fmtNum(lineAdds)}`} highlight />
            </div>
          )}

          {/* ===== LINE Harness CV Details ===== */}
          {cvReport.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">LINE Harness コンバージョン</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {cvReport.map((cv) => (
                  <div key={cv.conversionPointId} className="bg-white rounded-lg border border-gray-200 p-4">
                    <p className="text-xs text-gray-500 mb-1 truncate" title={cv.conversionPointName}>{cv.conversionPointName}</p>
                    <p className="text-xl font-bold text-green-600">{fmtNum(cv.totalCount)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{cv.eventType}</span>
                      <span className="text-xs text-gray-400">CPA {fmtCpa(spend, cv.totalCount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== Age Breakdown ===== */}
          {ageRows.length > 0 && <AgeTable rows={ageRows} />}

          {/* ===== Campaign / AdSet / Ad Tables ===== */}
          <MetaTable title="キャンペーン別" rows={campaigns} nameKey="campaign_name" />
          <MetaTable title="広告セット別" rows={adsets} nameKey="adset_name" />
          <MetaTable title="広告別" rows={ads} nameKey="ad_name" />

          {/* ===== Actions Breakdown ===== */}
          {summary?.actions && summary.actions.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Metaアクション内訳</h2>
              <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">アクション</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">件数</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">単価 (円)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {summary.actions.map((action) => {
                      const costAction = summary.cost_per_action_type?.find(
                        (c) => c.action_type === action.action_type,
                      )
                      return (
                        <tr key={action.action_type} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{action.action_type}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600 tabular-nums">{fmtNum(parseInt(action.value))}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600 tabular-nums">{costAction ? fmtJpy(parseFloat(costAction.value)) : '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!summary && !error && (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
              <p>広告データがありません。</p>
              <p className="text-xs mt-2">Meta広告プラットフォームに <code>ad_account_id</code> が設定されているか確認してください。</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Meta access token expiry badge shown in the page header. Warns before the
// token lapses (which would silently break ad data loading): green when far
// off / non-expiring, yellow within 60 days, red within 30 days or expired.
function TokenStatusBadge({ status }: { status: TokenStatus | null }) {
  if (!status) return null

  // expires_at = 0 means a non-expiring (system user) token.
  const neverExpires = status.expiresAt === 0
  const expMs = status.expiresAt && status.expiresAt > 0 ? status.expiresAt * 1000 : null
  const daysLeft = expMs !== null ? Math.floor((expMs - Date.now()) / 86_400_000) : null
  const expired = daysLeft !== null && daysLeft < 0

  let tone: { box: string; dot: string; label: string }
  if (!status.isValid || expired) {
    tone = { box: 'bg-red-50 border-red-300 text-red-700', dot: 'bg-red-500', label: 'text-red-600' }
  } else if (neverExpires) {
    tone = { box: 'bg-green-50 border-green-300 text-green-700', dot: 'bg-green-500', label: 'text-green-600' }
  } else if (daysLeft !== null && daysLeft <= 30) {
    tone = { box: 'bg-red-50 border-red-300 text-red-700', dot: 'bg-red-500', label: 'text-red-600' }
  } else if (daysLeft !== null && daysLeft <= 60) {
    tone = { box: 'bg-amber-50 border-amber-300 text-amber-700', dot: 'bg-amber-500', label: 'text-amber-600' }
  } else {
    tone = { box: 'bg-green-50 border-green-300 text-green-700', dot: 'bg-green-500', label: 'text-green-600' }
  }

  let main: string
  let sub: string
  if (!status.isValid) {
    main = 'トークン無効'
    sub = '再設定が必要'
  } else if (neverExpires) {
    main = '無期限'
    sub = expMs === null ? 'Meta トークン' : ''
  } else if (expired) {
    main = '期限切れ'
    sub = expMs ? new Date(expMs).toLocaleDateString('ja-JP') : ''
  } else {
    main = `あと ${daysLeft} 日`
    sub = expMs ? new Date(expMs).toLocaleDateString('ja-JP') : ''
  }

  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${tone.box}`} title="Meta アクセストークンの有効期限">
      <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
      <div className="leading-tight">
        <p className="text-[10px] uppercase tracking-wide opacity-70">🔑 Meta トークン</p>
        <p className="text-sm font-bold">{main}</p>
        {sub && <p className={`text-[10px] ${tone.label}`}>{sub}</p>}
      </div>
    </div>
  )
}

function KpiCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`bg-white rounded-lg border p-4 ${highlight ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${highlight ? 'text-green-700' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
