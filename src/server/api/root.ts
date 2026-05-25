/**
 * MailForge — tRPC API Root
 *
 * All routers are wired here.
 */

import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { mailRouter } from "./routers/mail";
import { accountsRouter } from "./routers/accounts";
import { labelsRouter } from "./routers/labels";
import { contactsRouter } from "./routers/contacts";
import { filtersRouter } from "./routers/filters";
import { draftsRouter } from "./routers/drafts";
import { settingsRouter } from "./routers/settings";
import { adminRouter } from "./routers/admin";

/**
 * This is the primary router for the MailForge API.
 */
export const appRouter = createTRPCRouter({
  mail: mailRouter,
  accounts: accountsRouter,
  labels: labelsRouter,
  contacts: contactsRouter,
  filters: filtersRouter,
  drafts: draftsRouter,
  settings: settingsRouter,
  admin: adminRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.mail.listMessages({ limit: 50 });
 */
export const createCaller = createCallerFactory(appRouter);
