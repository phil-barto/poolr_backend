// plaid-link-token — step 1 of Plaid Link. Mints a short-lived link_token scoped
// to the calling user, which the app feeds to the Plaid Link SDK. PLAID_SECRET is
// needed here, so this MUST be server-side.

import { requireUser } from "../_shared/auth.ts";
import { json, serveFunction } from "../_shared/http.ts";
import { plaidFetch } from "../_shared/plaid.ts";

serveFunction(async (req) => {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const data = await plaidFetch("/link/token/create", {
    user: { client_user_id: user.id },
    client_name: "Poolr",
    products: ["transactions"],
    country_codes: ["US"],
    language: "en",
  });

  return json({ linkToken: data.link_token }, 200);
});
