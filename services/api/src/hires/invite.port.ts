import { Injectable, Logger } from '@nestjs/common';

export type InviteJob = { hireId: string; name: string; email: string };

export interface InvitePort {
  send(job: InviteJob): void | Promise<void>;
}

export const INVITE_PORT = Symbol('INVITE_PORT');

/** Queue the worker consumes (services/worker/src/jobs/index.ts NOTIFICATIONS_QUEUE). */
export const NOTIFICATIONS_QUEUE = 'notifications.send';

/**
 * Default port. The API has no pg-boss dependency yet, so the job is only logged against the
 * `notifications.send` queue name; the Invitations epic replaces this with the real enqueue.
 */
@Injectable()
export class QueueInvitePort implements InvitePort {
  private readonly logger = new Logger(QueueInvitePort.name);

  send(job: InviteJob): void {
    this.logger.log(`enqueued invite for hire ${job.hireId} on ${NOTIFICATIONS_QUEUE}`);
  }
}
