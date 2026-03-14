import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { env } from "@/lib/env";
import { Header } from "@/components/layout/Header";
import {
  getSourceDetailStatsCached,
  getSourceComparisonTrendsCached,
  getSourceModelBreakdownCached,
} from "@/lib/db/cached";
import { getSourceBreakdown } from "@/lib/db/stats";
import { ToolComparisonChart } from "@/components/stats/ToolComparisonChart";
import { ModelShareChart } from "@/components/stats/ModelShareChart";
import { StatCard } from "@/components/stats/StatCard";
import { ChartCard } from "@/components/stats/ChartCard";
import { StatsFaq } from "@/components/stats/StatsFaq";
import { StatsCta } from "@/components/stats/StatsCta";
import { friendlyModelName } from "@/lib/chart-utils";

const BASE_URL = env.NEXT_PUBLIC_BASE_URL;

export const revalidate = 3600;

// ─── Tool metadata ──────────────────────────────────────────────────────────

interface ToolMeta {
  slug: string;
  name: string;
  color: string;
  provider: string;
  description: string;
  website: string;
}

const TOOL_REGISTRY: Record<string, ToolMeta> = {
  "claude-code": {
    slug: "claude-code",
    name: "Claude Code",
    color: "#F9A615",
    provider: "Anthropic",
    description:
      "Anthropic's official CLI for Claude. An agentic coding assistant that works directly in your terminal with full access to your codebase.",
    website: "https://claude.ai/claude-code",
  },
  opencode: {
    slug: "opencode",
    name: "OpenCode",
    color: "#3b82f6",
    provider: "Community",
    description:
      "An open-source terminal-based AI coding assistant that supports multiple LLM providers. Designed as a flexible alternative with provider-agnostic model support.",
    website: "https://github.com/opencode-ai/opencode",
  },
  codex: {
    slug: "codex",
    name: "Codex CLI",
    color: "#10b981",
    provider: "OpenAI",
    description:
      "OpenAI's command-line coding agent that uses GPT-4o and o-series models. Brings OpenAI's models to the terminal for code generation and editing.",
    website: "https://github.com/openai/codex",
  },
};

const FALLBACK_COLOR = "#6366f1";

function getToolMeta(slug: string): ToolMeta {
  return (
    TOOL_REGISTRY[slug] ?? {
      slug,
      name: slug,
      color: FALLBACK_COLOR,
      provider: "Unknown",
      description: `An AI coding tool tracked on clawdboard.`,
      website: "",
    }
  );
}

/** Build ordered list of tools from live breakdown data, sorted by cost desc */
function getActiveTools(
  breakdown: { source: string; totalCost: number }[]
): ToolMeta[] {
  return [...breakdown]
    .sort((a, b) => b.totalCost - a.totalCost)
    .map((b) => getToolMeta(b.source));
}

/** Format tool names as "A, B, and C" or "A and B" etc. */
function toolNameList(tools: ToolMeta[]): string {
  const names = tools.map((t) => t.name);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/** Format tool names as "A vs B vs C" */
function toolVsList(tools: ToolMeta[]): string {
  return tools.map((t) => t.name).join(" vs ");
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

// ─── Metadata ───────────────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const breakdown = await getSourceBreakdown();
  const activeTools = getActiveTools(breakdown);
  const totalUsers = breakdown.reduce((s, b) => s + b.userCount, 0);
  const totalCost = breakdown.reduce((s, b) => s + b.totalCost, 0);

  const vsNames = toolVsList(activeTools);
  const listNames = toolNameList(activeTools);

  const title = `AI Coding Tool Comparison — ${vsNames} | clawdboard`;
  const description = `Compare ${listNames} usage side by side. Real data from ${totalUsers}+ developers: ${formatCurrency(totalCost)}+ total spend, model breakdowns, daily trends, and adoption metrics. Updated hourly.`;

  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}/stats/tools` },
    openGraph: {
      title: `AI Coding Tool Comparison — Real Usage Data from ${totalUsers}+ Developers`,
      description,
      type: "website",
      url: `${BASE_URL}/stats/tools`,
    },
    keywords: [
      ...activeTools.flatMap((t) => [
        `${t.name.toLowerCase()} usage statistics`,
        `${t.name.toLowerCase()} cost`,
      ]),
      ...activeTools
        .slice(0, -1)
        .map(
          (t, i) =>
            `${t.name.toLowerCase()} vs ${activeTools[i + 1].name.toLowerCase()}`
        ),
      "ai coding tool comparison",
      "ai coding tool cost",
      "vibecoding tools",
      "best ai coding tool",
      "ai coding assistant comparison",
    ],
  };
}

// ─── FAQ data ───────────────────────────────────────────────────────────────

function getToolsFaqs(
  breakdown: Awaited<ReturnType<typeof getSourceBreakdown>>,
  activeTools: ToolMeta[]
) {
  const totalUsers = breakdown.reduce((s, b) => s + b.userCount, 0);
  const totalCost = breakdown.reduce((s, b) => s + b.totalCost, 0);
  const sorted = [...breakdown].sort((a, b) => b.totalCost - a.totalCost);
  const topSource = sorted[0];
  const topTool = topSource ? getToolMeta(topSource.source) : activeTools[0];
  const toolCount = activeTools.length;
  const listNames = toolNameList(activeTools);

  // Build a summary like "Claude Code (Anthropic's CLI), OpenCode (open-source), and Codex CLI (OpenAI's agent)"
  const toolSummary = activeTools
    .map((t) => `${t.name} (${t.provider})`)
    .join(", ")
    .replace(/, ([^,]*)$/, ", and $1");

  return [
    {
      q: "What AI coding tools does clawdboard track?",
      a: `clawdboard tracks usage from ${toolCount} AI coding tool${toolCount !== 1 ? "s" : ""}: ${toolSummary}. Each tool's usage is tracked separately, allowing side-by-side comparison of cost, token usage, and model preferences.`,
    },
    {
      q: "Which AI coding tool is most popular?",
      a: `Based on data from ${totalUsers} developers, ${topTool?.name ?? "the leading tool"} leads with ${topSource ? formatCurrency(topSource.totalCost) : "$0"} in estimated API cost (${topSource && totalCost > 0 ? ((topSource.totalCost / totalCost) * 100).toFixed(1) : "0"}% of total spend). Popularity is measured by estimated cost, which reflects total usage volume weighted by model pricing.`,
    },
    {
      q: "How does clawdboard track usage across different tools?",
      a: `The clawdboard CLI reads local log files from each supported tool on a developer's machine. ${listNames} all maintain local usage logs. The CLI extracts token counts and model identifiers from these logs and syncs aggregate data to clawdboard. No code, prompts, or conversation content is collected.`,
    },
    {
      q: "Can I use multiple AI coding tools with clawdboard?",
      a: `Yes. If you use multiple supported tools, the clawdboard CLI will detect and sync usage from all installed tools. Your profile page shows a breakdown by tool, and the leaderboard aggregates your total spend across all tools.`,
    },
    {
      q: "How are costs estimated for different tools?",
      a: "All costs are estimated from token counts and published API pricing for each model. Usage is priced at the respective provider's rates (Anthropic, OpenAI, etc.). These are API-equivalent estimates — most developers pay flat subscription fees.",
    },
    {
      q: "How often is tool comparison data updated?",
      a: "Individual developers sync their usage every 2 hours by default. The aggregate statistics on this page are recalculated hourly. New tools are added to tracking as they gain community adoption.",
    },
  ];
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function ToolsPage() {
  const breakdown = await getSourceBreakdown();
  const activeTools = getActiveTools(breakdown);

  const [comparisonTrends, ...toolDetails] = await Promise.all([
    getSourceComparisonTrendsCached(),
    ...activeTools.map((t) => getSourceDetailStatsCached(t.slug)),
  ]);

  // Fetch model breakdowns for each tool that has data
  const toolModels = await Promise.all(
    activeTools.map((t, i) =>
      toolDetails[i]
        ? getSourceModelBreakdownCached(t.slug)
        : Promise.resolve([])
    )
  );

  const totalCost = breakdown.reduce((s, b) => s + b.totalCost, 0);
  const totalTokens = breakdown.reduce((s, b) => s + b.totalTokens, 0);
  const totalUsers = breakdown.reduce((s, b) => s + b.userCount, 0);
  const toolCount = activeTools.length;
  const listNames = toolNameList(activeTools);

  // Rank tools by cost for dynamic prose
  const rankedTools = [...breakdown]
    .sort((a, b) => b.totalCost - a.totalCost)
    .map((b) => ({
      ...getToolMeta(b.source),
      cost: b.totalCost,
      share: totalCost > 0 ? ((b.totalCost / totalCost) * 100).toFixed(1) : "0",
    }));

  const faqs = getToolsFaqs(breakdown, activeTools);

  const lastUpdated = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  // ─── JSON-LD ──────────────────────────────────────────────────────────────

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
      { "@type": "ListItem", position: 3, name: "Tool Comparison" },
    ],
  };

  const datasetLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "AI Coding Tool Usage Comparison",
    description: `Side-by-side comparison of ${listNames} usage from ${totalUsers}+ developers. ${formatCurrency(totalCost)}+ total estimated cost, updated hourly.`,
    url: `${BASE_URL}/stats/tools`,
    dateModified: new Date().toISOString(),
    creator: {
      "@type": "Organization",
      name: "clawdboard",
      url: BASE_URL,
    },
    variableMeasured: [
      "Estimated cost per tool (USD)",
      "Token consumption per tool",
      "User count per tool",
      "Model breakdown per tool",
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
        subtitle="tool comparison"
        rightContent={
          <Link
            href="/stats"
            className="font-mono text-xs text-muted transition-colors hover:text-accent"
          >
            &larr; all stats
          </Link>
        }
      />

      <main className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* ── Breadcrumb ─────────────────────────────────────────────── */}
        <nav
          className="mb-6 font-mono text-xs text-muted"
          aria-label="Breadcrumb"
        >
          <ol className="flex items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-accent transition-colors">
                clawdboard
              </Link>
            </li>
            <li className="text-dim">/</li>
            <li>
              <Link
                href="/stats"
                className="hover:text-accent transition-colors"
              >
                stats
              </Link>
            </li>
            <li className="text-dim">/</li>
            <li className="text-foreground">tools</li>
          </ol>
        </nav>

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <div className="mb-10">
          <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            <span className="text-accent mr-2">&gt;</span>
            AI Coding Tool Comparison
          </h1>
          <p className="mt-2 font-mono text-sm leading-relaxed text-muted max-w-3xl">
            Side-by-side comparison of{" "}
            {activeTools.map((tool, i) => (
              <span key={tool.slug}>
                {i > 0 && i < activeTools.length - 1 && ", "}
                {i > 0 && i === activeTools.length - 1 && ", and "}
                <strong className="text-foreground">{tool.name}</strong>
              </span>
            ))}{" "}
            usage from{" "}
            <strong className="text-foreground">
              {totalUsers.toLocaleString()} developers
            </strong>{" "}
            on{" "}
            <Link href="/" className="text-accent hover:underline">
              clawdboard
            </Link>
            . All costs are estimated from token counts and published API
            pricing.
          </p>
          {/* Data summary for LLM crawlers — visually hidden */}
          <span className="sr-only">
            As of {lastUpdated.split(",").slice(0, 2).join(",")},{" "}
            {totalUsers.toLocaleString()} developers have tracked{" "}
            {formatCurrency(totalCost)} in estimated AI coding spend and{" "}
            {formatTokens(totalTokens)} tokens across {toolCount} tool
            {toolCount !== 1 ? "s" : ""} on clawdboard.{" "}
            {rankedTools.map((t, i) => (
              <span key={t.slug}>
                {i === 0
                  ? `${t.name} leads with ${t.share}% of total spend (${formatCurrency(t.cost)})`
                  : i < rankedTools.length - 1
                    ? `, followed by ${t.name} at ${t.share}% (${formatCurrency(t.cost)})`
                    : `, and ${t.name} at ${t.share}% (${formatCurrency(t.cost)})`}
              </span>
            ))}
            . Data is updated hourly from opt-in developer usage logs.
          </span>
          <p className="mt-2 font-mono text-[11px] text-dim">
            Last updated: {lastUpdated} &middot; Refreshed hourly
          </p>
        </div>

        {/* ── Community totals ──────────────────────────────────────── */}
        <section className="mb-10" aria-labelledby="totals-heading">
          <h2
            id="totals-heading"
            className="text-xl font-semibold text-foreground mb-1"
          >
            <span className="text-accent mr-1.5">&gt;</span>
            Community Totals
          </h2>
          <p className="font-mono text-xs text-muted mb-4">
            Aggregate usage across all tracked AI coding tools.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              label="Total Estimated Cost"
              value={formatCurrency(totalCost)}
              sub="across all tools"
              accent
            />
            <StatCard
              label="Total Tokens"
              value={formatTokens(totalTokens)}
              sub="processed across all tools"
            />
            <StatCard
              label="Tools Tracked"
              value={String(toolCount)}
              sub={`AI coding tool${toolCount !== 1 ? "s" : ""}`}
            />
          </div>
        </section>

        {/* ── Cost share bar ─────────────────────────────────────────── */}
        <section className="mb-10" aria-labelledby="share-heading">
          <h2
            id="share-heading"
            className="text-xl font-semibold text-foreground mb-1"
          >
            <span className="text-accent mr-1.5">&gt;</span>
            Cost Share by Tool
          </h2>
          <p className="font-mono text-xs text-muted mb-4">
            How is AI coding spend distributed across tools?
          </p>
          <div className="rounded-lg border border-border bg-surface p-6">
            {totalCost > 0 && (
              <>
                <div className="flex h-6 w-full overflow-hidden rounded-full border border-border">
                  {activeTools.map((tool) => {
                    const b = breakdown.find((x) => x.source === tool.slug);
                    const share = b ? (b.totalCost / totalCost) * 100 : 0;
                    if (share === 0) return null;
                    return (
                      <div
                        key={tool.slug}
                        style={{
                          width: `${share}%`,
                          backgroundColor: tool.color,
                        }}
                        title={`${tool.name}: ${formatCurrency(b?.totalCost ?? 0)} (${share.toFixed(1)}%)`}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-wrap justify-between mt-3 gap-3">
                  {activeTools.map((tool) => {
                    const b = breakdown.find((x) => x.source === tool.slug);
                    const share = b ? (b.totalCost / totalCost) * 100 : 0;
                    return (
                      <div
                        key={tool.slug}
                        className="flex items-center gap-2 font-mono text-xs text-muted"
                      >
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: tool.color }}
                        />
                        <span>
                          {tool.name} — {share.toFixed(1)}% ({formatCurrency(b?.totalCost ?? 0)})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── Per-tool cards ────────────────────────────────────────── */}
        <section className="mb-10" aria-labelledby="tools-heading">
          <h2
            id="tools-heading"
            className="text-xl font-semibold text-foreground mb-1"
          >
            <span className="text-accent mr-1.5">&gt;</span>
            Tool Breakdown
          </h2>
          <p className="font-mono text-xs text-muted mb-4">
            Usage, cost, and adoption metrics for each tracked tool.
          </p>
          <div className="space-y-4">
            {activeTools.map((tool, i) => {
              const detail = toolDetails[i];
              const topModels = toolModels[i]?.slice(0, 3) ?? [];
              if (!detail) return null;

              const cost = parseFloat(detail.totalCost);
              const avgCost = parseFloat(detail.avgCostPerUser);
              const medianCost = parseFloat(detail.medianCostPerUser);

              return (
                <div
                  key={tool.slug}
                  className="rounded-lg border border-border bg-surface overflow-hidden"
                >
                  {/* Tool header */}
                  <div
                    className="flex items-center gap-3 px-5 py-4 border-b border-border"
                    style={{
                      borderLeft: `3px solid ${tool.color}`,
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-base font-bold text-foreground">
                        {tool.name}
                      </h3>
                      <p className="font-mono text-xs text-muted mt-0.5">
                        {tool.description}
                      </p>
                    </div>
                    <div
                      className="shrink-0 rounded-full px-3 py-1 font-mono text-xs font-semibold"
                      style={{
                        backgroundColor: `${tool.color}15`,
                        color: tool.color,
                      }}
                    >
                      {detail.costShare}%
                    </div>
                  </div>

                  {/* Tool stats */}
                  <div className="p-5">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
                      <StatCard
                        label="Estimated Cost"
                        value={formatCurrency(cost)}
                        sub={`${detail.costShare}% of total`}
                      />
                      <StatCard
                        label="Total Tokens"
                        value={formatTokens(detail.totalTokens)}
                        sub={`${formatTokens(detail.inputTokens)} in / ${formatTokens(detail.outputTokens)} out`}
                      />
                      <StatCard
                        label="Developers"
                        value={detail.userCount.toLocaleString()}
                        sub={`avg: ${formatCurrency(avgCost)} / med: ${formatCurrency(medianCost)}`}
                      />
                      <StatCard
                        label="Active Days"
                        value={detail.activeDays.toLocaleString()}
                        sub={
                          detail.firstSeen
                            ? `since ${formatDate(detail.firstSeen)}`
                            : "tracked"
                        }
                      />
                    </div>

                    {/* Data summary for LLM crawlers — visually hidden */}
                    <span className="sr-only">
                      {tool.name} accounts for {detail.costShare}% of
                      community spend on clawdboard with{" "}
                      {formatCurrency(cost)} in estimated API cost across{" "}
                      {detail.userCount.toLocaleString()} developer
                      {detail.userCount !== 1 ? "s" : ""}.
                      The average {tool.name} user has spent an estimated{" "}
                      {formatCurrency(avgCost)} (median: {formatCurrency(medianCost)}),
                      consuming {formatTokens(detail.totalTokens)} tokens
                      ({formatTokens(detail.inputTokens)} input,{" "}
                      {formatTokens(detail.outputTokens)} output).
                      {topModels.length > 0 && (
                        <> The most-used model{topModels.length > 1 ? "s" : ""} through {tool.name}{" "}
                        {topModels.length > 1 ? "are" : "is"}{" "}
                        {topModels
                          .map(
                            (m) =>
                              `${friendlyModelName(m.modelName)} (${m.costShare}% of ${tool.name} spend)`
                          )
                          .join(", ")
                          .replace(/, ([^,]*)$/, ", and $1")}
                        .</>
                      )}
                      {detail.firstSeen && (
                        <> Usage has been tracked since{" "}
                        {formatDate(detail.firstSeen)}.</>
                      )}
                    </span>

                    {/* Top models for this tool */}
                    {topModels.length > 0 && (
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-wider text-muted mb-2">
                          Top models
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {topModels.map((m) => {
                            const mSlug = m.modelName.replace(
                              /-\d{6,8}$/,
                              ""
                            );
                            return (
                              <Link
                                key={m.modelName}
                                href={`/stats/models/${mSlug}`}
                                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 font-mono text-xs text-muted transition-colors hover:border-accent/40 hover:text-foreground"
                              >
                                <span className="font-medium">
                                  {friendlyModelName(m.modelName)}
                                </span>
                                <span className="text-dim">
                                  {m.costShare}%
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Daily cost trends ────────────────────────────────────── */}
        <section className="mb-12" aria-labelledby="trends-heading">
          <h2
            id="trends-heading"
            className="text-xl font-semibold text-foreground mb-1"
          >
            <span className="text-accent mr-1.5">&gt;</span>
            Daily Cost Trends by Tool
          </h2>
          <p className="font-mono text-xs text-muted mb-4">
            How does daily estimated spend compare across{" "}
            {toolNameList(activeTools)}? This chart shows the 7-day moving
            average to smooth out daily variance.
          </p>
          <ChartCard>
            <ToolComparisonChart data={comparisonTrends} />
          </ChartCard>
        </section>

        {/* ── Model breakdown per tool ─────────────────────────────── */}
        {activeTools.map((tool, i) => {
          const models = toolModels[i];
          if (!models || models.length === 0) return null;
          return (
            <section
              key={tool.slug}
              className="mb-10"
              aria-labelledby={`${tool.slug}-models-heading`}
            >
              <h2
                id={`${tool.slug}-models-heading`}
                className="text-xl font-semibold text-foreground mb-1"
              >
                <span className="text-accent mr-1.5">&gt;</span>
                {tool.name} Model Breakdown
              </h2>
              <p className="font-mono text-xs text-muted mb-4">
                Which models do {tool.name} users prefer? Cost share breakdown
                across all models used through {tool.name}.
              </p>
              <ChartCard>
                <ModelShareChart data={models} linkToModelPages />
              </ChartCard>
            </section>
          );
        })}

        {/* ── Divider: data zone → analysis zone ─────────────────── */}
        <div className="border-t border-border my-14" />

        {/* ── Analysis ─────────────────────────────────────────────── */}
        <section
          className="mb-10 rounded-lg border border-border bg-surface p-6"
          aria-labelledby="analysis-heading"
        >
          <h2
            id="analysis-heading"
            className="text-lg font-semibold text-foreground mb-3"
          >
            AI Coding Tool Landscape
          </h2>
          <div className="space-y-3 font-mono text-sm leading-relaxed text-muted">
            <p>
              The AI coding tool ecosystem is evolving rapidly. clawdboard
              currently tracks {toolCount} tool{toolCount !== 1 ? "s" : ""}:{" "}
              {activeTools.map((tool, i) => (
                <span key={tool.slug}>
                  {i > 0 && i < activeTools.length - 1 && ", "}
                  {i > 0 && i === activeTools.length - 1 && ", and "}
                  <strong className="text-foreground">{tool.name}</strong>
                  {" "}({tool.provider})
                </span>
              ))}
              .
            </p>
            {rankedTools.length > 1 && (
              <p>
                By estimated cost,{" "}
                <strong className="text-foreground">
                  {rankedTools[0].name}
                </strong>{" "}
                currently leads at {rankedTools[0].share}% of total spend,
                followed by{" "}
                {rankedTools.slice(1).map((t, i) => (
                  <span key={t.slug}>
                    {i > 0 &&
                      i < rankedTools.length - 2 &&
                      ", "}
                    {i > 0 &&
                      i === rankedTools.length - 2 &&
                      ", and "}
                    <strong className="text-foreground">{t.name}</strong> (
                    {t.share}%)
                  </span>
                ))}
                .
              </p>
            )}
            <p>
              Cost share is influenced by both adoption (number of users) and
              model pricing (higher-tier models cost more per token). A tool
              with fewer users but more expensive models can have a larger cost
              share than a widely-adopted tool using budget models.
            </p>
            <p>
              clawdboard is the only platform tracking real usage data across
              {toolCount > 1
                ? ` all ${toolCount} tools side by side`
                : " this tool"
              }, providing a unique view of how
              developers actually use AI coding assistants in practice.
            </p>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────── */}
        <StatsFaq
          heading="AI Coding Tool FAQ"
          description="Common questions about AI coding tool usage data and comparisons."
          faqs={faqs}
        />

        {/* ── CTA ──────────────────────────────────────────────────── */}
        <StatsCta
          heading="Track Your AI Coding Usage"
          description={`Works with ${toolNameList(activeTools)}. Free, open-source, takes 30 seconds.`}
          primaryLabel="View Leaderboard"
          primaryHref="/"
          secondaryLabel="All Statistics"
          secondaryHref="/stats"
        />
      </main>
    </div>
  );
}
