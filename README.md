# Bainsla Voice

Consent-first automated voice calling: upload consented contacts (Excel/CSV), approve audio and a provider-verified caller ID, then create, approve and run campaigns. Every call is re-checked at dispatch for consent, opt-out/DND, calling hours, caps and (for election calls) MCMC/DLT/silence-period rules.

## Stack
Next.js 16 (app + API) · Prisma/PostgreSQL · Redis + BullMQ worker · ffmpeg/ffprobe for audio.

## Local setup
```bash
npm ci
cp .env.example .env            # set DATABASE_URL, REDIS_URL, APP_URL
npx prisma migrate deploy
SEED_ADMIN_PASSWORD='...' npm run db:seed
npm run dev                     # web
npm run worker                  # dispatcher / scheduler (separate shell)
```

Checks: `npm run typecheck && npm run lint && npm test && npm run build`.
`scripts/smoke.py` runs the full mock flow against a running instance (`BV_URL`, `BV_EMAIL`, `BV_PASSWORD`).

## Providers
- `mock` (default): no real calls. Outcome by destination's last digit — 0 no answer, 1 busy, 2 transient failure (retried), 3 invalid, 9 answered + pressed 9 (opt-out), else completed.
- `exotel`: set `EXOTEL_SID`, `EXOTEL_API_KEY`, `EXOTEL_API_TOKEN`, `EXOTEL_SUBDOMAIN`, `EXOTEL_FLOW_ID`, `EXOTEL_WEBHOOK_TOKEN`, then pick it in Settings.

## Production env
`APP_SECRET`, `PII_ENCRYPTION_KEY` (32 bytes base64), `PHONE_HASH_KEY`, `MOCK_WEBHOOK_SECRET` are required when `NODE_ENV=production`. Also `DATABASE_URL`, `REDIS_URL`, `APP_URL`, `INTERNAL_APP_URL`, `AUDIO_DIR`.

Run web with `npm start -- -p <port>` (binds 127.0.0.1) behind nginx, and the worker with `npm run worker`.

## Election calls
Disabled until Settings has: political calls enabled, provider political approval, DLT principal entity ID. Each political audio needs an MCMC certificate, each campaign an attestation, and contacts need purpose-specific consent — voter lists are not consent. Calls run 09:00–21:00 only and stop during configured silence periods.
