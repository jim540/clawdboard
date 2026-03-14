import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { env } from "@/lib/env";
import { Header } from "@/components/layout/Header";
import {
  getModelDetailStatsCached,
  getModelDailyTrendsCached,
  getModelStatsCached,
  getDistinctModelSlugsCached,
} from "@/lib/db/cached";
import { ModelTrendChart } from "@/components/stats/ModelTrendChart";
import { StatCard } from "@/components/stats/StatCard";
import { ChartCard } from "@/components/stats/ChartCard";
import { StatsFaq } from "@/components/stats/StatsFaq";
import { StatsCta } from "@/components/stats/StatsCta";
import { friendlyModelName } from "@/lib/chart-utils";
import { getModelSeoMeta } from "@/lib/models";

const BASE_URL = env.NEXT_PUBLIC_BASE_URL;

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ model: string }>;
}

// ─── Static params for build-time generation ────────────────────────────────

export async function generateStaticParams() {
  const slugs = await getDistinctModelSlugsCached();
  return slugs.map((model) => ({ model }));
}

// ─── Formatting helpers ─────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 100_000) return `$${(n / 1_000).toFixed(0)}k`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function tokenRatio(input: number, output: number): string {
  const total = input + output;
  if (total === 0) return "0% / 0%";
  return `${((input / total) * 100).toFixed(0)}% input / ${((output / total) * 100).toFixed(0)}% output`;
}

// ─── Metadata ───────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { model: slug } = await params;
  const detail = await getModelDetailStatsCached(slug);

  if (!detail) {
    return { title: "Model Not Found" };
  }

  const displayName = friendlyModelName(detail.rawModelIds[0] ?? slug);
  const seo = getModelSeoMeta(slug);
  const cost = formatCurrency(parseFloat(detail.totalCost));
  const users = detail.userCount;

  const title = `${displayName} Usage & Cost Statistics — Real Data from ${users} Developers`;
  const description = `${displayName} is ${seo.description}. ${users} developers have used ${displayName} with ${cost}+ in estimated API cost and ${formatTokens(detail.totalTokens)}+ tokens consumed. Live data from clawdboard, updated hourly.`;

  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}/stats/models/${slug}` },
    openGraph: {
      title: `${displayName} Usage Statistics — ${users} Developers, ${cost}+ Spend`,
      description,
      type: "website",
      url: `${BASE_URL}/stats/models/${slug}`,
    },
    keywords: [
      ...seo.keywords,
      `${displayName.toLowerCase()} cost`,
      `${displayName.toLowerCase()} usage statistics`,
      `${displayName.toLowerCase()} tokens`,
      `how much does ${displayName.toLowerCase()} cost`,
    ],
  };
}

// ─── FAQ data ───────────────────────────────────────────────────────────────

function getModelFaqs(
  displayName: string,
  detail: NonNullable<Awaited<ReturnType<typeof getModelDetailStatsCached>>>,
  seo: ReturnType<typeof getModelSeoMeta>,
  rank: number,
  totalModels: number
) {
  const avgCost = formatCurrency(parseFloat(detail.avgCostPerUser));
  const medianCost = formatCurrency(parseFloat(detail.medianCostPerUser));

  return [
    {
      q: `How much does ${displayName} cost for coding?`,
      a: `Based on data from ${detail.userCount} developers on clawdboard, the average estimated ${displayName} usage cost is ${avgCost} per developer (all-time). The median is ${medianCost}. These are estimated API-equivalent costs calculated from token counts and published ${seo.provider} pricing — most developers pay flat subscription fees, not per-token billing.`,
    },
    {
      q: `How popular is ${displayName} compared to other AI coding models?`,
      a: `${displayName} ranks #${rank} out of ${totalModels} tracked models by total estimated cost, accounting for ${detail.costShare}% of all community spend on clawdboard. ${detail.userCount} developers have used ${displayName}. Higher-tier models often dominate cost share even with fewer users due to higher per-token pricing.`,
    },
    {
      q: `What is ${displayName} used for in coding?`,
      a: `${displayName} is ${seo.description}. Developers use it through AI coding tools tracked by clawdboard — including Claude Code, OpenCode, and Codex CLI. The token ratio for ${displayName} is ${tokenRatio(detail.inputTokens, detail.outputTokens)}, indicating how developers interact with the model.`,
    },
    {
      q: `Where does this ${displayName} usage data come from?`,
      a: `All data comes from developers who voluntarily track their AI coding usage through clawdboard. The CLI reads local log files from supported tools on each developer's machine and extracts aggregate token counts and model identifiers. No code, prompts, or conversation content is collected — only token counts and estimated costs.`,
    },
    {
      q: `How often is ${displayName} data updated?`,
      a: `Individual developers sync their usage every 2 hours by default. The aggregate statistics on this page are recalculated hourly. ${displayName} has been tracked on clawdboard since ${detail.firstSeen ? formatDate(detail.firstSeen) : "it was first used by a community member"}.`,
    },
  ];
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function ModelPage({ params }: PageProps) {
  const { model: slug } = await params;

  const [detail, trends, allModels] = await Promise.all([
    getModelDetailStatsCached(slug),
    getModelDailyTrendsCached(slug),
    getModelStatsCached(),
  ]);

  if (!detail) notFound();

  const displayName = friendlyModelName(detail.rawModelIds[0] ?? slug);
  const seo = getModelSeoMeta(slug);

  // Group by slug and sum costs for ranking
  const slugCosts = new Map<string, number>();
  for (const m of allModels) {
    const s = m.modelName.replace(/-\d{6,8}$/, "");
    slugCosts.set(s, (slugCosts.get(s) ?? 0) + parseFloat(m.totalCost));
  }
  const rankedSlugs = [...slugCosts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([s]) => s);
  const totalModels = rankedSlugs.length;
  const rank = rankedSlugs.indexOf(slug) + 1 || totalModels;

  // Find related models (other models from same provider, excluding self)
  const relatedModels = allModels
    .filter((m) => {
      const s = m.modelName.replace(/-\d{6,8}$/, "");
      if (s === slug) return false;
      const meta = getModelSeoMeta(s);
      return meta.provider === seo.provider;
    })
    .slice(0, 4);

  const totalCost = parseFloat(detail.totalCost);
  const avgCost = parseFloat(detail.avgCostPerUser);
  const medianCost = parseFloat(detail.medianCostPerUser);
  const costPerToken = detail.totalTokens > 0
    ? totalCost / detail.totalTokens
    : 0;

  const faqs = getModelFaqs(displayName, detail, seo, rank, totalModels);

  // ─── JSON-LD ────────────────────────────────────────────────────────────────

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "Usage Statistics",
        item: `${BASE_URL}/stats`,
      },
      { "@type": "ListItem", position: 3, name: `${displayName} Statistics` },
    ],
  };

  const datasetLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${displayName} Coding Usage Statistics`,
    description: `Usage statistics for ${displayName} across ${detail.userCount} developers — estimated cost ${formatCurrency(totalCost)}+, ${formatTokens(detail.totalTokens)}+ tokens consumed. Updated hourly from opt-in developer usage logs.`,
    url: `${BASE_URL}/stats/models/${slug}`,
    dateModified: new Date().toISOString(),
    temporalCoverage: detail.firstSeen
      ? `${detail.firstSeen}/..`
      : "2024-01-01/..",
    creator: {
      "@type": "Organization",
      name: "clawdboard",
      url: BASE_URL,
    },
    variableMeasured: [
      `${displayName} estimated cost (USD)`,
      `${displayName} token consumption`,
      `${displayName} user count`,
      `${displayName} cost share`,
    ],
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };

  const lastUpdated = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  // Tier badge colors
  const tierColors: Record<string, string> = {
    flagship: "text-amber-400 border-amber-400/30 bg-amber-400/10",
    fast: "text-blue-400 border-blue-400/30 bg-blue-400/10",
    efficient: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  };

  return (
    <div className="relative min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />

      <Header
        subtitle={`${displayName.toLowerCase()} statistics`}
        rightContent={
          <Link
            href="/stats"
            className="font-mono text-xs text-muted transition-colors hover:text-accent"
          >
            &larr; all models
          </Link>
        }
      />

      <main className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* ── Breadcrumb ─────────────────────────────────────────────── */}
        <nav className="mb-6 font-mono text-xs text-muted" aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-accent transition-colors">
                clawdboard
              </Link>
            </li>
            <li className="text-dim">/</li>
            <li>
              <Link href="/stats" className="hover:text-accent transition-colors">
                stats
              </Link>
            </li>
            <li className="text-dim">/</li>
            <li className="text-foreground">{displayName.toLowerCase()}</li>
          </ol>
        </nav>

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <div className="mb-10">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
              <span className="text-accent mr-2">&gt;</span>
              {displayName} Usage Statistics
            </h1>
            {seo.tier && tierColors[seo.tier] && (
              <span
                className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${tierColors[seo.tier]}`}
              >
                {seo.tier}
              </span>
            )}
          </div>
          <p className="mt-2 font-mono text-sm leading-relaxed text-muted max-w-3xl">
            Real usage data for{" "}
            <strong className="text-foreground">{displayName}</strong> from{" "}
            <strong className="text-foreground">
              {detail.userCount.toLocaleString()} developers
            </strong>{" "}
            on{" "}
            <Link href="/" className="text-accent hover:underline">
              clawdboard
            </Link>
            . {displayName} is {seo.description}. All costs are
            estimated from token counts and published {seo.provider} API
            pricing.
          </p>
          {/* Data summary for LLM crawlers — visually hidden */}
          <span className="sr-only">
            As of {lastUpdated.split(",").slice(0, 2).join(",")},{" "}
            {displayName} ranks #{rank} out of {totalModels} tracked AI coding
            models on clawdboard, accounting for {detail.costShare}% of total
            community spend. {detail.userCount.toLocaleString()} developer
            {detail.userCount !== 1 ? "s have" : " has"} used {displayName},{" "}
            generating {formatCurrency(totalCost)} in estimated API cost and{" "}
            {formatTokens(detail.totalTokens)} tokens
            ({formatTokens(detail.inputTokens)} input,{" "}
            {formatTokens(detail.outputTokens)} output).
            The average estimated cost per developer is{" "}
            {formatCurrency(avgCost)} (median: {formatCurrency(medianCost)}).
            {detail.firstSeen && (
              <> {displayName} has been tracked on clawdboard since{" "}
              {formatDate(detail.firstSeen)}.</>
            )}{" "}
            Data is updated hourly from opt-in developer usage logs.
          </span>
          <p className="mt-2 font-mono text-[11px] text-dim">
            Last updated: {lastUpdated} &middot; Refreshed hourly
            {detail.firstSeen && (
              <> &middot; Tracked since {formatDate(detail.firstSeen)}</>
            )}
          </p>
        </div>

        {/* ── Key metrics — headline row ──────────────────────────── */}
        <section className="mb-10" aria-labelledby="overview-heading">
          <h2
            id="overview-heading"
            className="text-xl font-semibold text-foreground mb-1"
          >
            <span className="text-accent mr-1.5">&gt;</span>
            {displayName} at a Glance
          </h2>
          <p className="font-mono text-xs text-muted mb-4">
            Aggregate {displayName} usage across all {detail.userCount}{" "}
            developers who have used this model.
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-3">
            <StatCard
              label="Total Estimated Cost"
              value={formatCurrency(totalCost)}
              sub={`${detail.costShare}% of community spend`}
              accent
            />
            <StatCard
              label="Total Tokens"
              value={formatTokens(detail.totalTokens)}
              sub={tokenRatio(detail.inputTokens, detail.outputTokens)}
            />
            <StatCard
              label="Developers"
              value={detail.userCount.toLocaleString()}
              sub={`using ${displayName}`}
            />
            <StatCard
              label="Model Rank"
              value={`#${rank}`}
              sub={`of ${totalModels} tracked models`}
            />
          </div>

          {/* Detail metrics row — separated with label */}
          <p className="font-mono text-[10px] uppercase tracking-wider text-dim mt-5 mb-2">
            Detailed breakdown
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Avg Cost per Developer"
              value={formatCurrency(avgCost)}
              sub={`median: ${formatCurrency(medianCost)}`}
            />
            <StatCard
              label="Input Tokens"
              value={formatTokens(detail.inputTokens)}
              sub="prompt + context"
            />
            <StatCard
              label="Output Tokens"
              value={formatTokens(detail.outputTokens)}
              sub="generated responses"
            />
            <StatCard
              label="Avg Cost per Token"
              value={
                costPerToken > 0
                  ? `$${costPerToken.toFixed(6)}`
                  : "—"
              }
              sub="estimated blended rate"
            />
          </div>
        </section>

        {/* ── Daily usage trends ─────────────────────────────────── */}
        <section className="mb-12" aria-labelledby="trends-heading">
          <h2
            id="trends-heading"
            className="text-xl font-semibold text-foreground mb-1"
          >
            <span className="text-accent mr-1.5">&gt;</span>
            {displayName} Daily Usage Trends
          </h2>
          <p className="font-mono text-xs text-muted mb-4">
            How much are developers spending on {displayName} each day?
            This chart shows the 7-day moving average of estimated daily
            cost and active user count. Spikes often correspond to new
            version releases or pricing changes.
          </p>
          <ChartCard>
            <ModelTrendChart data={trends} modelName={displayName} />
          </ChartCard>
        </section>

        {/* ── Divider: data zone → analysis zone ─────────────────── */}
        <div className="border-t border-border my-14" />

        {/* ── Token breakdown ────────────────────────────────────── */}
        <section
          className="mb-10 rounded-lg border border-border bg-surface p-6"
          aria-labelledby="tokens-heading"
        >
          <h2
            id="tokens-heading"
            className="text-lg font-semibold text-foreground mb-3"
          >
            {displayName} Token Breakdown
          </h2>
          <div className="space-y-3 font-mono text-sm leading-relaxed text-muted">
            <p>
              Developers have consumed{" "}
              <strong className="text-foreground">
                {formatTokens(detail.totalTokens)} tokens
              </strong>{" "}
              through {displayName}, split between{" "}
              <strong className="text-foreground">
                {formatTokens(detail.inputTokens)} input tokens
              </strong>{" "}
              (prompts, context, files) and{" "}
              <strong className="text-foreground">
                {formatTokens(detail.outputTokens)} output tokens
              </strong>{" "}
              (generated code, explanations, edits).
            </p>
            {(detail.cacheCreationTokens > 0 ||
              detail.cacheReadTokens > 0) && (
              <p>
                Prompt caching has processed{" "}
                <strong className="text-foreground">
                  {formatTokens(detail.cacheCreationTokens)} cache creation
                  tokens
                </strong>{" "}
                and{" "}
                <strong className="text-foreground">
                  {formatTokens(detail.cacheReadTokens)} cache read tokens
                </strong>
                . Cache reads are significantly cheaper per token, reducing the
                effective cost for developers with repeated context.
              </p>
            )}
            <p>
              The{" "}
              {detail.inputTokens > detail.outputTokens
                ? "higher input-to-output ratio suggests developers send substantial context (files, documentation, error messages) along with their prompts"
                : "higher output-to-input ratio suggests the model generates more content than it receives, typical for code generation and completion tasks"}
              .
            </p>

            {/* Visual token bar */}
            {detail.totalTokens > 0 && (
              <div className="mt-4">
                <div className="flex h-4 w-full overflow-hidden rounded-full border border-border">
                  <div
                    className="bg-accent"
                    style={{
                      width: `${(detail.inputTokens / detail.totalTokens) * 100}%`,
                    }}
                    title={`Input: ${formatTokens(detail.inputTokens)}`}
                  />
                  <div
                    className="bg-blue-500"
                    style={{
                      width: `${(detail.outputTokens / detail.totalTokens) * 100}%`,
                    }}
                    title={`Output: ${formatTokens(detail.outputTokens)}`}
                  />
                </div>
                <div className="flex justify-between mt-1.5 text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-accent" />
                    Input ({((detail.inputTokens / detail.totalTokens) * 100).toFixed(0)}%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                    Output ({((detail.outputTokens / detail.totalTokens) * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Cost analysis ──────────────────────────────────────── */}
        <section
          className="mb-10 rounded-lg border border-border bg-surface p-6"
          aria-labelledby="cost-heading"
        >
          <h2
            id="cost-heading"
            className="text-lg font-semibold text-foreground mb-3"
          >
            How Much Does {displayName} Cost for Coding?
          </h2>
          <div className="space-y-3 font-mono text-sm leading-relaxed text-muted">
            <p>
              Based on data from {detail.userCount} developers, the
              average estimated {displayName} usage cost is{" "}
              <strong className="text-foreground">
                {formatCurrency(avgCost)}
              </strong>{" "}
              per developer (all-time). The median is{" "}
              <strong className="text-foreground">
                {formatCurrency(medianCost)}
              </strong>
              , reflecting the gap between occasional and heavy {displayName}{" "}
              users.
            </p>
            <p>
              {displayName} accounts for{" "}
              <strong className="text-foreground">
                {detail.costShare}% of total community spend
              </strong>{" "}
              across all {totalModels} tracked models, ranking{" "}
              <strong className="text-foreground">#{rank}</strong> by estimated
              cost.
              {seo.tier === "flagship" &&
                " As a flagship model, it commands a higher per-token price, which means it can dominate cost share even when other models see more total requests."}
              {seo.tier === "fast" &&
                " As a fast, cost-efficient model, it processes more requests per dollar, so its cost share may underrepresent actual usage volume."}
            </p>
            <p>
              These are estimated API-equivalent costs, not actual bills.
              Most developers use {displayName} through subscription-based
              tools (Claude Code, OpenCode, Codex CLI) with flat monthly
              pricing. The estimated cost is useful for comparing usage
              intensity across models and developers.
            </p>
          </div>
        </section>

        {/* ── Related models ─────────────────────────────────────── */}
        {relatedModels.length > 0 && (
          <section className="mb-10" aria-labelledby="related-heading">
            <h2
              id="related-heading"
              className="text-xl font-semibold text-foreground mb-1"
            >
              <span className="text-accent mr-1.5">&gt;</span>
              Other {seo.provider} Models
            </h2>
            <p className="font-mono text-xs text-muted mb-4">
              Compare {displayName} with other {seo.provider} models tracked
              on clawdboard.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {relatedModels.map((m) => {
                const mSlug = m.modelName.replace(/-\d{6,8}$/, "");
                const mName = friendlyModelName(m.modelName);
                const mCost = parseFloat(m.totalCost);
                const mSeo = getModelSeoMeta(mSlug);
                return (
                  <Link
                    key={m.modelName}
                    href={`/stats/models/${mSlug}`}
                    className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent/40 hover:bg-surface-hover"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm font-medium text-foreground truncate">
                          {mName}
                        </p>
                        {mSeo.tier && tierColors[mSeo.tier] && (
                          <span
                            className={`shrink-0 rounded-full border px-1.5 py-0 font-mono text-[9px] uppercase tracking-wider ${tierColors[mSeo.tier]}`}
                          >
                            {mSeo.tier}
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-xs text-muted">
                        {formatCurrency(mCost)} &middot; {m.costShare}% of
                        spend &middot; {m.userCount}{" "}
                        {m.userCount === 1 ? "user" : "users"}
                      </p>
                    </div>
                    <span className="text-muted text-xs">&rarr;</span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ── FAQ ────────────────────────────────────────────────── */}
        <StatsFaq
          heading={`${displayName} FAQ`}
          description={`Common questions about ${displayName} usage, cost, and performance data.`}
          faqs={faqs}
        />

        {/* ── CTA ────────────────────────────────────────────────── */}
        <StatsCta
          heading={`Track Your ${displayName} Usage`}
          description={`See how your ${displayName} usage compares. Free, open-source, takes 30 seconds.`}
          primaryLabel="View Leaderboard"
          primaryHref="/"
          secondaryLabel="All Model Statistics"
          secondaryHref="/stats"
        />
      </main>
    </div>
  );
}
