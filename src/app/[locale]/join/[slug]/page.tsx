export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { cachedAuth } from "@/lib/auth";
import {
  getTeamBySlug,
  getTeamMembership,
  getTeamMembers,
  getTeamStats,
} from "@/lib/db/teams";
import { SignInButton } from "@/components/auth/SignInButton";
import { JoinCard, type JoinState } from "./JoinCard";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string; error?: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const team = await getTeamBySlug(slug);
  const teamName = team?.name ?? "Team";
  return {
    title: `Join ${teamName} on clawdboard`,
    description: `You've been invited to join ${teamName}. Track and compare your team's Claude Code usage, costs, and streaks on clawdboard.`,
  };
}

export default async function JoinTeamPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const { token } = await searchParams;

  const team = await getTeamBySlug(slug);

  // Team not found
  if (!team) {
    return (
      <JoinLayout>
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <h1 className="mb-2 font-display text-xl font-bold text-foreground">
            Team not found
          </h1>
          <p className="font-mono text-sm text-muted">
            This team doesn&apos;t exist or has been dissolved.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block font-mono text-xs text-accent hover:underline"
          >
            Back to Leaderboard
          </Link>
        </div>
      </JoinLayout>
    );
  }

  // Invalid token
  if (!token || token !== team.inviteToken) {
    return (
      <JoinLayout>
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <h1 className="mb-2 font-display text-xl font-bold text-foreground">
            Invalid invite link
          </h1>
          <p className="font-mono text-sm text-muted">
            This invite link is expired or invalid. Ask a team owner for a new
            link.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block font-mono text-xs text-accent hover:underline"
          >
            Back to Leaderboard
          </Link>
        </div>
      </JoinLayout>
    );
  }

  // Fetch team data + auth in parallel; chain membership off auth
  const authPromise = cachedAuth();
  const membershipPromise = authPromise.then((s) =>
    s?.user?.id ? getTeamMembership(team.id, s.user.id) : null
  );

  const [stats, allMembers, session, membership] = await Promise.all([
    getTeamStats(team.id),
    getTeamMembers(team.id),
    authPromise,
    membershipPromise,
  ]);

  const activeMembers = allMembers.filter((m) => m.leftAt === null);
  const displayMembers = activeMembers.slice(0, 8);

  // Determine join state
  let joinState: JoinState;
  if (team.isLocked && !session?.user?.id) {
    joinState = "locked-unauthenticated";
  } else if (team.isLocked) {
    joinState = "locked";
  } else if (!session?.user?.id) {
    joinState = "unauthenticated";
  } else if (membership) {
    joinState = "already-member";
  } else {
    joinState = "ready";
  }

  return (
    <JoinLayout>
      <JoinCard
        team={{
          id: team.id,
          name: team.name,
          slug: team.slug,
          cookingUrl: team.cookingUrl,
          cookingLabel: team.cookingLabel,
        }}
        token={token}
        members={displayMembers.map((m) => ({
          userId: m.userId,
          githubUsername: m.githubUsername,
          image: m.image,
        }))}
        memberCount={activeMembers.length}
        stats={{
          totalCost: stats.totalCost,
          activeDays: stats.activeDays,
        }}
        state={joinState}
        signInSlot={<SignInButton redirectTo={`/join/${slug}?token=${token}`} />}
      />
    </JoinLayout>
  );
}

// ─── Shared layout wrapper ──────────────────────────────────────────────────

function JoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background">
      {/* Header */}
      <header className="relative z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="font-display text-xl font-bold tracking-tight text-foreground"
            >
              clawdboard
              <span className="animate-blink ml-0.5 text-accent">_</span>
            </Link>
            <span className="hidden sm:inline-block font-mono text-xs text-muted">
              {"// join team"}
            </span>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
      </header>

      {/* Main content */}
      <main className="relative z-10 mx-auto flex max-w-md items-center justify-center px-4 py-16 sm:px-6">
        {children}
      </main>
    </div>
  );
}
