import "server-only";

import { db } from "@/lib/db";
import { notifications } from "./schema";
import { eq, and, isNull, desc } from "drizzle-orm";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TeamInviteData {
  teamId: string;
  teamName: string;
  teamSlug: string;
  invitedBy: string;
  invitedByImage: string | null;
}

export interface NotificationRow {
  id: string;
  type: string;
  data: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
}

// ─── Queries ────────────────────────────────────────────────────────────────

export async function getUnactedNotifications(
  userId: string
): Promise<NotificationRow[]> {
  return db
    .select({
      id: notifications.id,
      type: notifications.type,
      data: notifications.data,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.actedAt)))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
}

export async function getNotificationById(
  notificationId: string
): Promise<
  | {
      id: string;
      userId: string;
      type: string;
      data: Record<string, unknown>;
      actedAt: Date | null;
    }
  | undefined
> {
  const [row] = await db
    .select({
      id: notifications.id,
      userId: notifications.userId,
      type: notifications.type,
      data: notifications.data,
      actedAt: notifications.actedAt,
    })
    .from(notifications)
    .where(eq(notifications.id, notificationId))
    .limit(1);
  return row;
}

export async function createNotification(
  userId: string,
  type: string,
  data: Record<string, unknown>
): Promise<void> {
  await db.insert(notifications).values({ userId, type, data });
}

export async function markNotificationActed(
  notificationId: string
): Promise<void> {
  await db
    .update(notifications)
    .set({ actedAt: new Date(), readAt: new Date() })
    .where(eq(notifications.id, notificationId));
}

export async function markNotificationRead(
  notificationId: string
): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(eq(notifications.id, notificationId));
}
