import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { goldRouter } from "./goldRouter";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

async function oauthServiceAvailable() {
  if (!ENV.oAuthServerUrl) return false;
  try {
    await fetch(ENV.oAuthServerUrl, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(2_500) });
    return true;
  } catch {
    return false;
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    oauthStatus: publicProcedure.query(async () => ({ available: await oauthServiceAvailable() })),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  ...goldRouter._def.record,
});

export type AppRouter = typeof appRouter;
