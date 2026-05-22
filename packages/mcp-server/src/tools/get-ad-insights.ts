import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";

const JPY_RATE = 150;

function getActionValue(
  actions: Array<{ action_type: string; value: string }> | undefined,
  type: string,
): number {
  if (!actions) return 0;
  const a = actions.find((x) => x.action_type === type);
  return a ? parseInt(a.value, 10) : 0;
}

function fmtJpy(usd: number): string {
  return `¥${Math.round(usd * JPY_RATE).toLocaleString()}`;
}

function fmtCpa(spendUsd: number, count: number): string {
  if (count === 0) return "-";
  return fmtJpy(spendUsd / count);
}

export function registerGetAdInsights(server: McpServer): void {
  server.tool(
    "get_ad_insights",
    `Get Meta ad performance data with LINE Harness funnel metrics.
Returns: impressions, clicks, spend (USD & JPY), Purchase count/CPA,
LINE friend adds, reservations, cost-per-acquisition at each funnel stage,
age breakdown, and campaign breakdown.
Use datePreset for quick ranges (last_7d, last_30d, last_90d) or
since/until for custom date ranges (e.g. since=2024-01-01, until=2025-12-31).
The data comes from Meta Marketing API + LINE Harness conversion tracking.`,
    {
      datePreset: z
        .string()
        .optional()
        .describe(
          "Preset date range: today, yesterday, last_7d, last_14d, last_30d, last_90d. Ignored if since/until are provided.",
        ),
      since: z
        .string()
        .optional()
        .describe("Start date (YYYY-MM-DD). Use with 'until' for custom range. Supports up to 37 months back."),
      until: z
        .string()
        .optional()
        .describe("End date (YYYY-MM-DD). Use with 'since' for custom range."),
      includeAge: z
        .boolean()
        .optional()
        .describe("Include age breakdown (default: true)"),
      includeCampaigns: z
        .boolean()
        .optional()
        .describe("Include campaign breakdown (default: true)"),
    },
    async ({ datePreset, since, until, includeAge, includeCampaigns }) => {
      try {
        const client = getClient();
        const query = since && until ? { since, until } : { datePreset: datePreset ?? "last_30d" };
        const wantAge = includeAge !== false;
        const wantCampaigns = includeCampaigns !== false;

        // Fetch all data in parallel
        const promises: Promise<unknown>[] = [
          client.adInsights.summary(query),
        ];
        if (wantCampaigns) {
          promises.push(client.adInsights.campaigns({ ...query, level: "campaign" }));
        }
        if (wantAge) {
          promises.push(client.adInsights.age(query));
        }

        const results = await Promise.allSettled(promises);

        const summaryResult = results[0];
        let campaignsResult = wantCampaigns ? results[1] : undefined;
        let ageResult = wantAge ? results[wantCampaigns ? 2 : 1] : undefined;

        // Build summary
        const sections: string[] = [];
        const period = since && until ? `${since} 〜 ${until}` : (datePreset ?? "last_30d");
        sections.push(`## 広告パフォーマンス（${period}）\n`);

        if (summaryResult.status === "fulfilled") {
          const summary = summaryResult.value as { data: Array<Record<string, unknown>> };
          const row = summary.data?.[0];
          if (row) {
            const spend = parseFloat(row.spend as string);
            const impressions = parseInt(row.impressions as string);
            const clicks = parseInt(row.clicks as string);
            const actions = row.actions as Array<{ action_type: string; value: string }> | undefined;
            const purchase = getActionValue(actions, "purchase");
            const linkClick = getActionValue(actions, "link_click");
            const lpView = getActionValue(actions, "landing_page_view");

            sections.push(`### サマリー`);
            sections.push(`| 指標 | 値 |`);
            sections.push(`|------|-----|`);
            sections.push(`| 広告費 | ${fmtJpy(spend)} ($${spend.toFixed(2)}) |`);
            sections.push(`| インプレッション | ${impressions.toLocaleString()} |`);
            sections.push(`| リーチ | ${row.reach ? parseInt(row.reach as string).toLocaleString() : "-"} |`);
            sections.push(`| クリック | ${clicks.toLocaleString()} |`);
            sections.push(`| CTR | ${row.ctr}% |`);
            sections.push(`| CPC | ${fmtJpy(parseFloat(row.cpc as string || "0"))} |`);
            sections.push(`| リンククリック | ${linkClick.toLocaleString()} |`);
            sections.push(`| LP閲覧 | ${lpView.toLocaleString()} |`);
            sections.push(`| Purchase (Pixel) | ${purchase} |`);
            sections.push(`| Purchase CPA | ${fmtCpa(spend, purchase)} |`);
            sections.push(`| Purchase CVR | ${clicks > 0 ? (purchase / clicks * 100).toFixed(1) + "%" : "-"} |`);
            sections.push("");

            // Actions breakdown
            if (actions && actions.length > 0) {
              sections.push(`### アクション内訳`);
              sections.push(`| アクション | 件数 | 単価(円) |`);
              sections.push(`|-----------|------|---------|`);
              const costPerAction = row.cost_per_action_type as Array<{ action_type: string; value: string }> | undefined;
              for (const a of actions) {
                const cost = costPerAction?.find((c) => c.action_type === a.action_type);
                sections.push(
                  `| ${a.action_type} | ${parseInt(a.value).toLocaleString()} | ${cost ? fmtJpy(parseFloat(cost.value)) : "-"} |`,
                );
              }
              sections.push("");
            }
          } else {
            sections.push("データがありません。\n");
          }
        } else {
          sections.push(`サマリー取得エラー: ${summaryResult.reason}\n`);
        }

        // Age breakdown
        if (wantAge && ageResult && (ageResult as PromiseSettledResult<unknown>).status === "fulfilled") {
          const ageData = (ageResult as PromiseFulfilledResult<{ data: Array<Record<string, unknown>> }>).value;
          if (ageData.data?.length > 0) {
            sections.push(`### 年齢別パフォーマンス`);
            sections.push(`| 年齢 | Imp | クリック | CTR | 費用(円) | Purchase | CVR | CPA(円) |`);
            sections.push(`|------|-----|---------|-----|---------|---------|-----|---------|`);
            for (const row of ageData.data) {
              const rowSpend = parseFloat(row.spend as string);
              const rowClicks = parseInt(row.clicks as string);
              const rowPurchase = getActionValue(
                row.actions as Array<{ action_type: string; value: string }>,
                "purchase",
              );
              sections.push(
                `| ${row.age} | ${parseInt(row.impressions as string).toLocaleString()} | ${rowClicks.toLocaleString()} | ${row.ctr}% | ${fmtJpy(rowSpend)} | ${rowPurchase || "-"} | ${rowClicks > 0 ? (rowPurchase / rowClicks * 100).toFixed(1) + "%" : "-"} | ${fmtCpa(rowSpend, rowPurchase)} |`,
              );
            }
            sections.push("");
          }
        }

        // Campaign breakdown
        if (wantCampaigns && campaignsResult && (campaignsResult as PromiseSettledResult<unknown>).status === "fulfilled") {
          const campData = (campaignsResult as PromiseFulfilledResult<{ data: Array<Record<string, unknown>> }>).value;
          if (campData.data?.length > 0) {
            sections.push(`### キャンペーン別`);
            sections.push(`| キャンペーン | Imp | クリック | 費用(円) | Purchase | CPA(円) |`);
            sections.push(`|------------|-----|---------|---------|---------|---------|`);
            for (const row of campData.data) {
              const rowSpend = parseFloat(row.spend as string);
              const rowPurchase = getActionValue(
                row.actions as Array<{ action_type: string; value: string }>,
                "purchase",
              );
              sections.push(
                `| ${row.campaign_name || "-"} | ${parseInt(row.impressions as string).toLocaleString()} | ${parseInt(row.clicks as string).toLocaleString()} | ${fmtJpy(rowSpend)} | ${rowPurchase || "-"} | ${fmtCpa(rowSpend, rowPurchase)} |`,
              );
            }
            sections.push("");
          }
        }

        return {
          content: [{ type: "text" as const, text: sections.join("\n") }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: false, error: String(error) }, null, 2),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
