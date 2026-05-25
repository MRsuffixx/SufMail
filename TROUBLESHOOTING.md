# Troubleshooting Guide

Common issues and their solutions.

---

## Database Issues

### "Cannot connect to database"

1. Verify `DATABASE_URL` in `.env` is correct
2. Ensure PostgreSQL is running: `pg_isready` or check your cloud dashboard
3. For local DB: `sudo systemctl start postgresql`

### "Migration failed"

```bash
# Reset migrations (development only!)
pnpm db:migrate reset
pnpm db:push
pnpm db:seed
```

---

## Redis / Queue Issues

### "Cannot connect to Redis"

1. Verify `REDIS_URL` in `.env` is correct
2. Ensure Redis is running: `redis-cli ping`
3. For local Redis: `sudo systemctl start redis`

### "Jobs not being processed"

1. Ensure the worker is running: `pnpm worker:dev`
2. Check for errors in the worker terminal
3. Verify Redis connection in worker logs

---

## IMAP Sync Issues

### "Sync stuck / no new emails"

1. Check `config.mail.syncIntervalSeconds` — may be too long
2. Check IMAP credentials haven't expired (especially Gmail App Passwords)
3. Run manual sync trigger from the UI or via API
4. Check worker logs for connection errors

### "Authentication failed" on Gmail

- Gmail requires an **App Password**, not your regular password
- Generate one at: https://myaccount.google.com/apppasswords
- Ensure 2FA is enabled on your Google account

---

## Build / Type Errors

### "Cannot find module 'node:fs'"

- This happens if server-side code is imported in client components
- Move the import to a file that stays on the server (not in `src/components/`)

### "TypeScript errors after pulling"

```bash
pnpm install
pnpm db:generate
```

---

## Auth Issues

### "AUTH_SECRET not set"

```bash
npx auth secret
# Add output to .env as AUTH_SECRET
```

### "Token expired" loop

- Check `AUTH_SECRET` is consistent across restarts
- Verify `sessionMaxAgeSeconds` in `config.ts`

---

## Performance Issues

### "Slow page loads"

1. Enable PostgreSQL query logging to check for N+1 queries
2. Add appropriate database indexes
3. Consider enabling connection pooling

### "High memory usage"

1. Check for memory leaks in tRPC procedures
2. Limit attachment size in `config.ts`
3. Check Redis memory usage

---

## Still Stuck?

1. Search existing [GitHub Issues](https://github.com/yourusername/mailforge/issues)
2. Create a new issue with the Issue Template
3. Enable debug logging: set `LOG_LEVEL=debug` in `.env`