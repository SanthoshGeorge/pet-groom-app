// Injectable per-channel transports — BR-NOTIF-3's "channels are independent" design
// already implies each channel is a swappable, isolated dependency (tech-stack-decisions.md
// "Email — Resend (Q5=A)" / "SMS — Stub/log-only for now (Q6=B)"). Business logic
// (service.ts) depends only on these two interfaces, never on Resend's SDK or a real SMS
// provider's SDK directly — a later wiring step (API layer, Step 12+) provides the real
// Resend-backed `EmailSender`; this file provides the real (and only, for v1) `SmsSender`
// implementation directly, since "log-only" IS the whole of what SMS is in v1, not a
// deferred piece.

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface EmailSender {
  /** Rejects on failure — service.ts treats a rejected promise as that channel's failure (BR-NOTIF-3/4). Never throws synchronously; failures are async rejections. */
  send(message: EmailMessage): Promise<void>;
}

export interface SmsMessage {
  to: string;
  body: string;
}

export interface SmsSender {
  send(message: SmsMessage): Promise<void>;
}

/**
 * Q6=B (tech-stack-decisions.md) — SMS is stub/log-only in v1. Logs the full message
 * content (so "what would have been sent" stays visible/testable, per that doc's own
 * wording) and never actually dispatches anything, so this implementation never rejects —
 * the SMS channel effectively cannot fail in v1 (a direct, accepted consequence of it being
 * a stub, not a real provider integration; flagged in the Code Generation report rather
 * than silently assumed). Swapping in a real provider (e.g. Twilio) later is a config
 * change behind this same `SmsSender` interface, per deployment-architecture.md's "What
 * Changes When Real SMS Is Approved" — no change to `notification`'s business logic.
 */
export function createLogOnlySmsSender(log: (line: string) => void = (line) => console.log(line)): SmsSender {
  return {
    async send(message) {
      log(`[SMS STUB] to=${message.to} :: ${message.body}`);
    },
  };
}
