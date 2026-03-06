export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { cachedAuth } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { UserNav } from "@/components/auth/UserNav";
import { TeamSettings } from "@/components/teams/TeamSettings";
import {
  getTeamBySlug,
  getTeamMembers,
  getTeamMembership,
} from "@/lib/db/teams";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Team Settings — clawdboard",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TeamSettingsPage({ params }: PageProps) {
  const { slug } = await params;

  const [team, session] = await Promise.all([
    getTeamBySlug(slug),
    cachedAuth(),
  ]);

  if (!session?.user?.id) {
    redirect("/");
  }

  if (!team) {
    redirect("/");
  }

  const membership = await getTeamMembership(team.id, session.user.id);
  if (!membership) {
    redirect(`/team/${slug}`);
  }

  const isOwner = membership.role === "owner";
  const displayName =
    session.user.githubUsername ?? session.user.name ?? "user";

  const members = isOwner ? await getTeamMembers(team.id) : [];
  const isLastOwner = isOwner
    && members.filter((m) => !m.leftAt && m.role === "owner").length <= 1;

  const t = await getTranslations("team");

  return (
    <div className="min-h-screen bg-background">
      <Header
        subtitle="settings"
        rightContent={
          <UserNav name={displayName} image={session.user.image} />
        }
      />

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 space-y-6">
        <Link
          href={`/team/${slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors"
        >
          <span aria-hidden="true">&larr;</span> {t("backToTeam", { teamName: team.name })}
        </Link>

        <h1 className="font-display text-lg font-bold text-foreground">
          <span className="text-accent mr-2">$</span>
          team --settings
        </h1>

        <TeamSettings
          team={team}
          members={members}
          currentUserId={session.user.id}
          isLastOwner={isLastOwner}
          isOwner={isOwner}
        />
      </main>
    </div>
  );
}
