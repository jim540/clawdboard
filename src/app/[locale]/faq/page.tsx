export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { env } from "@/lib/env";
import { Header } from "@/components/layout/Header";
import { getTranslations } from "next-intl/server";

const BASE_URL = env.NEXT_PUBLIC_BASE_URL;

export const metadata: Metadata = {
  title: "FAQ — How Claude Code Tracking, Costs & Streaks Work",
  description:
    "Answers to common questions about clawdboard — how cost estimates work, what data is tracked, privacy guarantees, streak calculations, and how to join the leaderboard.",
  alternates: { canonical: `${BASE_URL}/faq` },
};

const FAQ_COUNT = 16;

export default async function FaqPage() {
  const t = await getTranslations("faq");

  // Build FAQ array from translation keys
  const faqs = Array.from({ length: FAQ_COUNT }, (_, i) => ({
    q: t(`q${i + 1}`),
    a: t(`a${i + 1}`),
  }));

  // JSON-LD structured data for Google rich results (uses translated text)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "FAQ" },
    ],
  };

  return (
    <div className="relative min-h-screen bg-background">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      {/* Header */}
      <Header
        subtitle="faq"
        rightContent={
          <Link
            href="/"
            className="font-mono text-xs text-muted transition-colors hover:text-accent"
          >
            &larr; {t("backToLeaderboard")}
          </Link>
        }
      />

      {/* Content */}
      <main className="relative z-10 mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">
          <span className="text-accent mr-2">&gt;</span>
          {t("heading")}
        </h1>
        <p className="font-mono text-sm text-muted mb-10">
          {t("intro")}
        </p>

        <div className="space-y-8">
          {faqs.map((faq, i) => (
            <section key={i} className="group">
              <h2 className="font-display text-base font-semibold text-foreground mb-2">
                <span className="text-accent mr-2 font-mono text-sm">
                  [{String(i + 1).padStart(2, "0")}]
                </span>
                {faq.q}
              </h2>
              <p className="font-mono text-sm leading-relaxed text-muted pl-10">
                {faq.a}
              </p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
