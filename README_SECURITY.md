# Salary PIN correction — deployment checklist

## Critical prerequisites
1. **Back up** Supabase `employees` and `payrolls` tables.
2. In Supabase SQL Editor run `supabase_migration.sql` (adds nullable `security_pin_hash`, no data deletion).
3. In Vercel → Project Settings → Environment Variables set **server-only** `SUPABASE_SERVICE_ROLE_KEY` (Supabase Project Settings → API Keys → service_role/secret key), `SESSION_SECRET` (random strong secret 32+ characters), and `SUPABASE_URL` (or retain `NEXT_PUBLIC_SUPABASE_URL`). Do **not** prefix server-only keys with `NEXT_PUBLIC_`. Do not commit keys.
4. **Mandatory:** Remove browser/anon read/write access to `employees` and `payrolls` in Supabase, including old permissive RLS policies. Review all grants and policies first. Example when the tables are exclusively for this salary app and no other app depends on anon access:

```sql
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payrolls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.employees FROM anon, authenticated;
REVOKE ALL ON public.payrolls FROM anon, authenticated;
```

If other apps use these tables, coordinate RLS/grants carefully; this is not a blanket instruction to run on shared tables. Verify the anon key cannot SELECT/UPDATE either table before publishing. Service-role server requests bypass RLS.
5. Deploy to a preview URL and test **existing PIN**, **new PIN once**, **repeat login**, **different staff accounts**, **logout**; then promote to production. Do not share real staff payroll in public test screenshots.

## Behavior
* Employee password + employee code are checked only on the server. Existing passwords are currently plaintext in the database; this patch does not reset them. Plan a separate password migration to a strong per-user hash and force change of default 123456.
* When `security_pin` exists, only verification is allowed. Existing PIN values are retained. On first successful verification, an additional scrypt hash is saved in `security_pin_hash`.
* PIN setup uses an atomic conditional UPDATE and checks that an actual row was changed. Another setup cannot overwrite existing PIN.
* Salary API requires a signed HttpOnly session issued after successful PIN verification and derives employee identity from server session, never a user supplied employee code.

## Additional production hardening required
* This baseline does **not** include persistent rate limiting or account lockout against PIN brute force. Implement durable per-employee/IP attempts tracking (Redis or DB), alerts, and a secure administrator-only PIN recovery procedure before allowing broad public access.
* The legacy plaintext `security_pin` values remain in the database for preservation. Once migration is verified and recovery procedures established, plan controlled removal of plaintext PIN values and ensure other integrations are updated.
* This repository was shown as **Public**. Make the GitHub repository private and rotate any credentials ever committed.
* Deploy these server endpoints and revoke direct data access **together**. Only replacing frontend code does not secure existing data if anon permissions remain.
