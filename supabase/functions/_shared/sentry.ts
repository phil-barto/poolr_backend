// Sentry for edge functions. Wrap a handler so uncaught errors get reported
// and flushed before the serverless invocation ends (else events are dropped).

import * as Sentry from "npm:@sentry/deno@^10";

Sentry.init({
  dsn: Deno.env.get("SENTRY_DSN"),
  // Set SENTRY_ENV to "production" in prod secrets; defaults to local.
  environment: Deno.env.get("SENTRY_ENV") ?? "development",
  tracesSampleRate: 0,
});

type Handler = (req: Request) => Response | Promise<Response>;

export function withSentry(handler: Handler): Handler {
  return async (req) => {
    try {
      return await handler(req);
    } catch (err) {
      Sentry.captureException(err);
      throw err;
    } finally {
      await Sentry.flush(2000);
    }
  };
}
