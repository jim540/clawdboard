import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getRecapById } from "@/lib/db/recaps";
import { env } from "@/lib/env";
import { RecapRedirect } from "./RecapRedirect";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const recap = await getRecapById(id);

  if (!recap) {
    return { title: "Recap not found" };
  }

  const periodLabel = recap.type === "weekly" ? "Weekly Recap" : "Monthly Recap";
  const s = new Date(recap.periodStart + "T12:00:00Z");
  const e = new Date(recap.periodEnd + "T12:00:00Z");
  const dateRange = `${s.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} \u2013 ${e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
  const title = `clawdboard ${periodLabel} \u2014 ${dateRange}`;
  const description = `Rank #${recap.data.rank} of ${recap.data.totalUsers} developers`;
  const ogImageUrl = `${env.NEXT_PUBLIC_BASE_URL}/api/og/recap/${id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `${env.NEXT_PUBLIC_BASE_URL}/recap/${id}`,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      siteName: "clawdboard",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function RecapPage({ params }: Props) {
  const { id } = await params;
  const recap = await getRecapById(id);

  if (!recap) {
    redirect("/");
  }

  // Render minimal page with OG tags (for crawlers), then redirect browsers to homepage
  return <RecapRedirect />;
}
