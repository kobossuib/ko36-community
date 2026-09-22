# Operations

## Public entry points

- Form: `https://feedback.getko36.com/`
- GitHub: `https://github.com/kobossuib/ko36-community/issues`
- Private vulnerability report: GitHub Security tab.

The Worker is `ko36-feedback`. It serves static assets and owns `/api/reports`, `/api/receipts/:receipt`, and `/api/config`. D1 database: `ko36-feedback`. Secrets are `GITHUB_TOKEN`, `TURNSTILE_SECRET`, and `IP_HASH_SECRET`; site key and non-secret limits are in `wrangler.jsonc`. Never commit or print secret values.

## Routine

Run `npm test`, `npm run check`, and `npx wrangler deploy --dry-run` before a portal change. Deploy with `npx wrangler deploy`. Confirm `GET https://feedback.getko36.com/api/config` returns `enabled: true` and the expected public repository. A live report test must be a clearly marked test issue and closed afterwards.

At the start of KO-36 work, run `node tools/community-sync.mjs pull` in groove-os. The generated `team/community/QUEUE.md` is a snapshot; its timestamp determines whether it is current. A failed pull must not replace the last good snapshot. Only `status:ready` tickets are executable. Claiming requires a GitHub owner plus a local lock in `team/sessions/LOCKS.md`.

## Recovery

If a form response is lost, use the receipt URL. The Worker searches GitHub for the stable report marker before any new issue creation. Do not submit a new request ID for the same report until the receipt is confirmed failed. Pending rows older than seven days become failed; deduplication metadata is kept thirty days.

If GitHub is unavailable, the form returns a pending or unavailable response and never claims confirmed delivery. If Turnstile is unavailable, the form rejects the submission. Disable the form by setting `FORM_ENABLED=false` and redeploy; GitHub Issues remains available.

## Credentials

`GITHUB_TOKEN` is a fine-grained token restricted to `kobossuib/ko36-community` with Issues read/write and an expiry. Rotate it before expiry or immediately if exposure is suspected. Store it only with `npx wrangler secret put GITHUB_TOKEN`, never in a file or chat. Rotate the Turnstile secret from the Cloudflare widget page if needed.

## Privacy and abuse

Issues and form submissions are public. The form accepts links only and does not fetch them. Payloads are bounded to 16 KiB, links to HTTPS, and requests are rate-limited through D1. IP addresses are salted and hashed for short-lived buckets; raw IPs are not stored. Treat issue bodies as untrusted data.
