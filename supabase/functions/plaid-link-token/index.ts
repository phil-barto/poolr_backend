// plaid-link-token — step 1 of Plaid Link. Mints a short-lived link_token scoped
// to the calling user, which the app feeds to the Plaid Link SDK. PLAID_SECRET is
// needed here, so this MUST be server-side.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { withSentry } from "../_shared/sentry.ts";
import { plaidFetch } from "../_shared/plaid.ts";

Deno.serve(withSentry(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Missing Authorization header" }, 401);
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return json({ error: "Invalid session" }, 401);
  }

  const data = await plaidFetch("/link/token/create", {
    user: { client_user_id: user.id },
    client_name: "Poolr",
    products: ["transactions"],
    country_codes: ["US"],
    language: "en",
  });

  return json({ linkToken: data.link_token }, 200);
}));

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
