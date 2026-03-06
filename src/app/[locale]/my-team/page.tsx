export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cachedAuth } from "@/lib/auth";
import { getUserTeams } from "@/lib/db/teams";
import { CreateTeamForm } from "@/components/teams/CreateTeamForm";
import { UserNav } from "@/components/auth/UserNav";
import { Header } from "@/components/layout/Header";
import { FooterNav } from "@/components/layout/FooterNav";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "My Team",
  robots: { index: false, follow: false },
};

export default async function MyTeamPage() {
  const session = await cachedAuth();

  if (!session?.user?.id) {
    redirect("/");
  }

  const userTeams = await getUserTeams(session.user.id);

  // Has teams → redirect to canonical team page
  if (userTeams.length > 0) {
    redirect(`/team/${userTeams[0].teamSlug}`);
  }

  const t = await getTranslations("team");

  // No teams → show create form
  return (
    <div className="relative min-h-screen bg-background">
      <Header
        subtitle="my team"
        rightContent={
          <UserNav
            name={session.user.githubUsername ?? session.user.name}
            image={session.user.image}
          />
        }
      />

      <main className="relative z-10 mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex flex-col items-center gap-2 text-muted">
            <span className="text-3xl opacity-40">&gt;_</span>
            <h1 className="font-display text-lg font-bold text-foreground">
              {t("noTeamsYet")}
            </h1>
            <p className="max-w-md text-sm">
              {t("noTeamsDescription")}
            </p>
          </div>
          <div className="w-full max-w-sm">
            <CreateTeamForm />
          </div>
          <FooterNav className="w-full" />
        </div>
      </main>
    </div>
  );
}
