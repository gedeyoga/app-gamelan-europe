import { NotificationChannel, Prisma } from '@prisma/client';

// Response API list/detail (worker fields `status`/`sentAt`/`scheduledAt` tidak diekspos).
export const notificationSelect = {
  id: true,
  type: true,
  entityType: true,
  entityId: true,
  title: true,
  body: true,
  imageUrl: true,
  linkPath: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

export type NotificationEntity = Prisma.NotificationGetPayload<{ select: typeof notificationSelect }>;

export const notificationPreferenceSelect = {
  type: true,
  channel: true,
  emailEnabled: true,
} satisfies Prisma.NotificationPreferenceSelect;

export type NotificationPreferenceEntity = Prisma.NotificationPreferenceGetPayload<{
  select: typeof notificationPreferenceSelect;
}>;

// Worker: row + penerima + baris preferensi email yang relevan (absen = enabled).
export const notificationSendSelect = {
  id: true,
  type: true,
  entityType: true,
  title: true,
  body: true,
  imageUrl: true,
  linkPath: true,
  status: true,
  user: {
    select: {
      email: true,
      status: true,
      notificationPreferences: {
        where: { channel: NotificationChannel.EMAIL },
        select: { type: true, emailEnabled: true },
      },
    },
  },
} satisfies Prisma.NotificationSelect;

export type NotificationSendEntity = Prisma.NotificationGetPayload<{ select: typeof notificationSendSelect }>;

export type NotificationQueueRow = {
  id: string;
  scheduledAt: Date;
};

