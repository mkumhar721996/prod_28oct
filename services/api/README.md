# Records API

NestJS service backed by PostgreSQL.

## Configuration

| Variable | Required | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string. The API fails fast at start when unset. |
| `SESSION_COOKIE_SECURE` | no | `true`/`false`; defaults to on when `NODE_ENV=production`. |
| `TRUST_PROXY_HOPS` | no | Proxy hops to trust for `X-Forwarded-For` (default 1: the web app's rewrite). Set 0 if the API is reached directly. The sign-in and registration limits key on the resulting client IP. |
| `WALLET_TOP_UP_CREDITS` | no | Credits a free top-up adds (default 500). A value that is not a whole number of 1 or more logs a warning and falls back to 500; the API still starts. Read once at start. |
| `PORT` | no | Listen port (default 3000). |

## Database migrations

Run once per environment, **before** starting a new API version:

```
cd services/api && DATABASE_URL=... pnpm run migrate
```

The SQL files in `migrations/` are idempotent (`create ... if not exists`), so re-running is safe.

## Sign-in and registration limits

Sign-in is refused with 429 after 10 failed attempts in 15 minutes for one email or one IP;
registration is limited to 20 per IP in 15 minutes. Counters are in memory, per API process.

The per-IP limits trust `X-Forwarded-For` (`TRUST_PROXY_HOPS`, default 1). **Keep the API reachable
only through the web app**: if its port is exposed directly with the default, a client can send its
own `X-Forwarded-For` and rotate it to get a fresh per-IP bucket on every request (the per-email
limit would still apply). Set `TRUST_PROXY_HOPS=0` for any deployment where clients reach the API
directly.
Passwords are 8 to 128 characters.

## Tests

`pnpm run test` is database-free. `pnpm run e2e` needs `DATABASE_URL` pointing at a throwaway
database with the migrations applied.
