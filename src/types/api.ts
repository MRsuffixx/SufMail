/**
 * MailForge — tRPC API Types
 *
 * Inferred output types from the tRPC router definitions.
 * Import these on the frontend for type-safe data access.
 */

import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "~/server/api/root";

/** Input types for all tRPC procedures */
export type RouterInputs = inferRouterInputs<AppRouter>;

/** Output types for all tRPC procedures */
export type RouterOutputs = inferRouterOutputs<AppRouter>;

// ─── Convenience Type Aliases ─────────────────────────────────────────────────

export type MessageListOutput = RouterOutputs["mail"]["listMessages"];
export type MessageOutput = RouterOutputs["mail"]["getMessage"];
export type ThreadOutput = RouterOutputs["mail"]["getThread"];
export type ThreadListOutput = RouterOutputs["mail"]["listThreads"];
export type SearchOutput = RouterOutputs["mail"]["searchMessages"];

export type AccountListOutput = RouterOutputs["accounts"]["list"];
export type AccountOutput = AccountListOutput[number];

export type LabelListOutput = RouterOutputs["labels"]["list"];
export type LabelOutput = LabelListOutput[number];

export type ContactListOutput = RouterOutputs["contacts"]["list"];
export type ContactOutput = ContactListOutput["contacts"][number];

export type FilterListOutput = RouterOutputs["filters"]["list"];
export type FilterOutput = FilterListOutput[number];

export type DraftListOutput = RouterOutputs["drafts"]["list"];
export type DraftOutput = RouterOutputs["drafts"]["get"];

export type UserSettingsOutput = RouterOutputs["settings"]["get"];
export type AdminStatsOutput = RouterOutputs["admin"]["getStats"];
