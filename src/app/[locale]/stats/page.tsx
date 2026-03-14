import { getTranslations } from "next-intl/server";
import { getSourceBreakdown } from "@/lib/db/stats";
import { SourceBreakdownChart } from "@/components/stats/SourceBreakdownChart";

export async function generateMetadata() {
  const t = await getTranslations("metadata");
  return {
    title: t("stats.title"),
    description: t("stats.description"),
  };
}

export default async function StatsPage() {
  const t = await getTranslations("stats");
  const sourceBreakdown = await getSourceBreakdown();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-8">
        {t("heading")}
      </h1>

      <div className="grid gap-6">
        <SourceBreakdownChart data={sourceBreakdown} />
      </div>
    </div>
  );
}
