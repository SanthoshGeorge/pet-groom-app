// notification module (NotificationService) — Code Generation Phase B, Step 8.
// Implements BR-NOTIF-1..7 (notification-business-rules.md) and all 5 flows from
// notification-business-logic-model.md. Its public service structurally satisfies
// `booking`'s locally-defined `NotificationCollaborator` (booking/service.ts) — the
// composition root (no later than Step 12) passes an instance of `createNotificationService`
// in as `booking`'s `notification` dependency.

export { REMINDER_SEND_TIME } from "./config";
export type { CreateScheduledReminderInput, DueReminder, NotificationRepository } from "./repository";
export { createLogOnlySmsSender } from "./senders";
export type { EmailMessage, EmailSender, SmsMessage, SmsSender } from "./senders";
export { createNotificationService } from "./service";
export type { NotificationService, NotificationServiceDependencies } from "./service";
export type {
  NotificationChannelResult,
  NotificationSendResult,
  ReminderBatchResult,
  ReminderStatus,
  ScheduledReminder,
  ScheduleReminderResult,
} from "./types";
