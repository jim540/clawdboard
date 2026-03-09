export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cachedAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

import { UserNav } from "@/components/auth/UserNav";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Header } from "@/components/layout/Header";
import { SetupGuide } from "@/components/onboarding/SetupGuide";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const session = await cachedAuth();

  if (!session?.user?.id) {
    redirect("/");
  }

  const [user] = await db
    .select({
      lastSyncAt: users.lastSyncAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (user?.lastSyncAt !== null) {
    redirect(`/user/${session.user.githubUsername ?? session.user.id}`);
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        rightContent={
          <>
            <NotificationBell />
            <UserNav
              name={session.user.githubUsername ?? session.user.name}
              image={session.user.image}
            />
          </>
        }
      />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <SetupGuide
          username={session.user.githubUsername ?? session.user.name ?? "there"}
          image={session.user.image}
        />
      </main>
    </div>
  );
}
