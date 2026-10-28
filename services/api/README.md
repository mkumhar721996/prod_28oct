# Records API

NestJS service backed by PostgreSQL.

## Configuration

| Variable | Required | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string. The API fails fast at start when unset. |
| `SESSION_COOKIE_SECURE` | no | `true`/`false`; defaults to on when `NODE_ENV=production`. |
| `TRUST_PROXY_HOPS` | no | Proxy hops to trust for `X-Forwarded-For` (default 1: the web app's rewrite). Set 0 if the API is reached directly. The sign-in and registration limits key on the resulting client IP. |
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
Passwords are 8 to 128 characters.

## Tests

`pnpm run test` is database-free. `pnpm run e2e` needs `DATABASE_URL` pointing at a throwaway
database with the migrations applied.
