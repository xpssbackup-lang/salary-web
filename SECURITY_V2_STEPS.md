# Security V2 — TEST ONLY

1. Back up existing `salary_web_test`. Confirm project name before running SQL.
2. Run `security_v2_test.sql` in Supabase TEST SQL Editor.
3. Keep existing `SESSION_SECRET`; add separate `PIN_HASH_SECRET` to Vercel Preview only. Do not change the former.
4. Replace source on GitHub Desktop `fix-pin-security` with the source in this archive, preserving folder paths. Do not copy any `.env`/CSV.
5. Local Mac: `npm install && npm run build`. **Do not Push until build passes**. Push only Preview.
6. Redeploy Vercel Preview. Use `TESTPIN001` and `TESTPIN002` with the original PINs: a successful verification migrates their old hashes to `scrypt2`. Test repeated login and wrong PIN attempts.
7. For a **new test employee**, create it on test DB and issue a one-time activation code with `scripts/issue-test-activation.mjs`. Do not put server keys into repository or shell history. Script expects test project environment variables `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PIN_HASH_SECRET` and a TESTPIN### account with no existing PIN.
8. Do not use V2 on production without a reviewed production cutover: verify old records, remove publicly permissive RLS policies, ensure server key is only on server, implement independent administrator identity verification and issuance, test 5-failure lock behavior and individual salary isolation. This patch does not implement a full admin dashboard, password migration, or per-IP login rate limit.

## Important cautions
- The 4-digit PIN is low-entropy; login failures and activation attempts should also be bounded. In this patch, PIN verify increments atomically in DB, but login/activation rate limiting remains a deployment prerequisite.
- Hash migration uses old `SESSION_SECRET` only when verifying legacy `scrypt` hashes; do not rotate it before migration.
- Legacy `security_pin` values remain in DB if they exist. Plan removal after all migrations and backups.
- The sample activation issuer is an operator-only script, **do not use it with production credentials**. It intentionally rejects non-TESTPIN account codes.
