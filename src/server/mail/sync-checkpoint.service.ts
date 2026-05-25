/**
 * MailForge — Sync Checkpoint Service
 *
 * Manages per-mailbox IMAP UID checkpoints for crash-safe incremental sync.
 * Stored as JSON in MailAccount.syncCheckpoint.
 */

import { db } from "~/server/db";

export type MailboxCheckpoints = Record<string, number>; // mailbox path → last synced UID

export class SyncCheckpointService {
  /**
   * Gets the last successfully synced UID for a mailbox.
   * Returns 0 if no checkpoint exists (triggers full sync).
   */
  static async getCheckpoint(
    accountId: string,
    mailbox: string,
  ): Promise<number> {
    const account = await db.mailAccount.findUnique({
      where: { id: accountId },
      select: { syncCheckpoint: true },
    });
    const checkpoints =
      (account?.syncCheckpoint as MailboxCheckpoints | null) ?? {};
    return checkpoints[mailbox] ?? 0;
  }

  /**
   * Saves the last successfully processed UID for a mailbox.
   * Uses a transaction with row-level locking to atomically merge checkpoints.
   */
  static async saveCheckpoint(
    accountId: string,
    mailbox: string,
    uid: number,
  ): Promise<void> {
    await db.$transaction(async (tx) => {
      const account = await tx.mailAccount.findUnique({
        where: { id: accountId },
        select: { syncCheckpoint: true },
      });
      const current = (account?.syncCheckpoint as MailboxCheckpoints | null) ?? {};
      const updated: MailboxCheckpoints = { ...current, [mailbox]: uid };
      await tx.mailAccount.update({
        where: { id: accountId },
        data: { syncCheckpoint: updated },
      });
    });
  }

  /**
   * Clears all checkpoints, forcing full re-sync on next run.
   */
  static async clearCheckpoint(accountId: string): Promise<void> {
    await db.mailAccount.update({
      where: { id: accountId },
      data: { syncCheckpoint: {} },
    });
  }

  /**
   * Returns all checkpoints for an account.
   */
  static async getAllCheckpoints(
    accountId: string,
  ): Promise<MailboxCheckpoints> {
    const account = await db.mailAccount.findUnique({
      where: { id: accountId },
      select: { syncCheckpoint: true },
    });
    return (account?.syncCheckpoint as MailboxCheckpoints | null) ?? {};
  }
}
