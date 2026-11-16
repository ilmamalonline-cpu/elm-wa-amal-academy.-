# أكاديمية علم وعمل — Elm wa Amal Academy

A bilingual, guardian-first academy platform built with Next.js and Supabase. A guardian owns the account and manages child profiles; children never sign in independently. The app supports general progress goals, session schedules and outcomes, teacher assignments, and one-time teacher invitations.

## Product boundaries

Quran, Tajweed and Nur al-Bayan lesson materials stay in Zoom and are not imported, stored or managed here. The platform does not create or store Zoom meeting links; teachers share those externally. Payments are simulated only: the app does not collect payment-card details or charge money.

## Local development

Use the publishable/anon key and URL for the same Supabase project. Do not use Production credentials to test preview flows.

```bash
npm ci
npm run dev
```

To verify a change locally:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

`NEXT_PUBLIC_ACADEMY_PREVIEW=true` adds a preview-only notice to the signup form. It does not enforce access; the database's `academy_platform_settings` row and auth.users trigger do.

## Database and release safety

The live guardian/child tables are the source of truth. Never run the archived student-booking schema or the SQL in `supabase/archive/`. The additive release migration is `supabase/migrations/20261116_guardian_platform_release.sql`. It uses `CREATE TABLE IF NOT EXISTS`, preserves existing guardian/child data, adds the missing teacher/session tables and RLS rules, and defaults registration to `owner_only`.

Roll out through the dedicated `preview/guardian-platform-repair-2026-11-16` branch first. Keep preview connected to the isolated preview Supabase project and allow only the owner's email to register there. Validate signup gating, family profile and child management, session privacy, teacher invitation/acceptance, teacher outcomes, access boundaries, tests, and the deployed preview. Do not merge to `main`, run the Production migration, or enable public Production registration until the preview tests pass.

For Production release, apply the same additive migration first; it still defaults to owner-only registration. Only after preview verification, merge the tested branch and deploy to Vercel Production, then explicitly set Production `academy_platform_settings.signup_mode` to `open`. Keep the preview row `owner_only`. No student/booking tables, real Zoom integrations, or payment gateway are part of this platform.

Vercel's preview deployments are SSO-protected in this project, so the owner may need to sign in to Vercel to open a preview link.

## Teacher onboarding

An administrator can create a seven-day, single-use invitation bound to the teacher's email. Only the SHA-256 token hash is stored. The app does not email the invite; the administrator copies and forwards the link. Teacher accounts become active only after the invited email is confirmed and the invite is accepted.
