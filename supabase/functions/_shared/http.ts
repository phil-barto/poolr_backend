// HTTP plumbing shared by every edge function: the JSON response helper and the
// serve wrapper that handles CORS preflight + Sentry so handlers hold only
// business logic.

import { corsHeaders } from "./cors.ts";
import { withSentry } from "./sentry.ts";

export function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Handler = (req: Request) => Response | Promise<Response>;

/// Standard entrypoint for every function: answers OPTIONS preflight, reports
/// uncaught errors to Sentry, then hands off to the handler.
export function serveFunction(handler: Handler): void {
  Deno.serve(withSentry((req) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    return handler(req);
  }));
}
