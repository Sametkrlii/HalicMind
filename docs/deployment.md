# Render Free + Supabase + Resend + Cloudflare Pages

## Render

Existing service: `HalicMind`, https://halicmind.onrender.com.

- Python: 3.12 (`.python-version`).
- Build: `pip install -r requirements.txt -c requirements.lock.txt`.
- Start: `python -m scripts.start_production`.
- Health check: `/health`.
- Free plan: startup performs the catalog import and Alembic migrations because pre-deploy jobs are unavailable. Import failures prevent startup. Use a single instance.
- Existing services do not automatically consume a newly added `render.yaml`; update their settings explicitly.

Set secrets in Render Environment, never in Git:

- `DATABASE_URL`: Supabase Connect → Session pooler URI, with URL-encoded password and `sslmode=require`. The `postgresql://` scheme is accepted. Use session mode, not transaction mode: catalog import contains multi-statement SQL and uses session settings.
- `DATABASE_SCHEMA=halicmind`: creates a private schema and keeps app tables out of Supabase's exposed `public` schema. Do not add this schema to the Data API exposed schemas.
- `JWT_SECRET_KEY`: an independent random secret of at least 32 characters.
- `PUBLIC_ORIGIN=https://halicmind.onrender.com`, then change to the exact Pages HTTPS origin when Pages is deployed. No wildcard origins.
- `MAIL_PROVIDER=resend`, `RESEND_API_KEY`, `MAIL_FROM`.
- `EXAM_SYNC_ENABLED=false`: the free server sleeps, so continuous polling cannot be guaranteed.

The supplied development env points to localhost. Do not upload it as production configuration. MCP authorization is separate from application database credentials; it does not supply a database password.

## Resend

Create an API key with sending permission. Add and verify a domain in Resend, then use a sender from that domain as `MAIL_FROM`. Render Free blocks standard SMTP ports; this implementation sends via HTTPS.

Resend's testing sender cannot deliver verification emails to arbitrary students. A `pages.dev` or `onrender.com` address does not give control over that provider's DNS for sender-domain verification. A verified domain or a different permitted sender service is needed for real student signup.

## Cloudflare Pages

Build command: `node scripts/build_pages.mjs`. Output directory: `dist/pages`.

Set `API_ORIGIN=https://halicmind.onrender.com` in the Pages production environment. The Pages Function proxies `/api/*` to this fixed backend, preserving cookies and the browser's Origin. API responses are never cached. Static assets use Pages directly. Set Render `PUBLIC_ORIGIN` to the exact production Pages origin; login from other origins is intentionally rejected.

Publish with a Cloudflare account/token that has Pages edit access. Preview deployments use separate origins; do not allow all preview origins for production sessions.

## Verification

Check Render `/health` for PostgreSQL status, catalog listing, Pages assets and `/api/v1/ui-config`. Register a disposable student test account, receive a real Resend email, verify it, log in, confirm HttpOnly/Secure cookies and reject cross-origin writes. Never run write tests against production user data. Keep backups before later migrations.
