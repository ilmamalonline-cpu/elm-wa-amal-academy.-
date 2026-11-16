# Academy release notes

The active platform now follows the guardian/child schema used by the isolated Supabase preview project. Old student booking, availability and Zoom-meeting creation code has been removed from the active application. Its former SQL migration is retained only under `supabase/archive/` and must not be run.

The release migration is additive and keeps existing guardian and child tables/data. Signup defaults to owner-only; public Production signup must be enabled explicitly only after preview tests pass. The application does not store Quran/Tajweed/Nur al-Bayan materials or Zoom URLs, and does not collect or charge real payments.
