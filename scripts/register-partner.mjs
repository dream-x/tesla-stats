// One-time registration of your domain with the Tesla Fleet API (required before any API call).
// Usage: node --env-file=.env.local scripts/register-partner.mjs your-domain.example.com
// The public key must already be reachable at
//   https://<domain>/.well-known/appspecific/com.tesla.3p.public-key.pem

const domain = process.argv[2];
const { TESLA_CLIENT_ID, TESLA_CLIENT_SECRET } = process.env;
const base = process.env.TESLA_FLEET_API_BASE || "https://fleet-api.prd.eu.vn.cloud.tesla.com";

if (!domain || !TESLA_CLIENT_ID || !TESLA_CLIENT_SECRET) {
  console.error("Usage: node --env-file=.env.local scripts/register-partner.mjs <domain>\nNeeds TESLA_CLIENT_ID and TESLA_CLIENT_SECRET.");
  process.exit(1);
}

const tokenRes = await fetch("https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "client_credentials",
    client_id: TESLA_CLIENT_ID,
    client_secret: TESLA_CLIENT_SECRET,
    scope: "openid vehicle_device_data",
    audience: base,
  }),
});
if (!tokenRes.ok) {
  console.error("Token error:", tokenRes.status, await tokenRes.text());
  process.exit(1);
}
const { access_token } = await tokenRes.json();

const res = await fetch(`${base}/api/1/partner_accounts`, {
  method: "POST",
  headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ domain }),
});
console.log(res.status, await res.text());
process.exit(res.ok ? 0 : 1);
