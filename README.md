# Workout Tracker

Mobile-first workout tracker built with Next.js, Supabase, and PWA support.

## Local Setup

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Supabase Setup

Recommended path for deployment: use the Supabase integration from Vercel Marketplace / Vercel Storage.

1. In Vercel, open your project.
2. Go to Storage or Marketplace and add Supabase.
3. Create or connect a Supabase project.
4. Open Supabase and run the SQL in `supabase/schema.sql`.
5. In Supabase Authentication, keep Email provider enabled.
6. In Supabase Authentication URL Configuration, set:
   - Site URL: your Vercel production URL
   - Redirect URLs: `https://your-domain.vercel.app/auth/callback`
7. Make sure these environment variables exist in Vercel:

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_PUBLISHABLE_KEY=
```

The Vercel Supabase integration injects these variables automatically. The app stores each user's data with `auth.uid()`, so every signed-in user sees only their own records.

If you already ran an older version of `supabase/schema.sql`, run the latest file again. It adds `user_id` columns and replaces public anon RLS policies with authenticated user policies.

For local development after linking the Vercel project:

```bash
npx vercel env pull .env.development.local
```

## Vercel

Deploy with the default Next.js settings. If you are not using the Vercel Supabase integration, add these variables manually in Vercel Project Settings:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_PUBLISHABLE_KEY`

## PWA

The app includes:

- `public/manifest.webmanifest`
- `public/sw.js`
- `public/icon-192.png`
- `public/icon-512.png`

After deploying to Vercel, open the HTTPS URL on your phone and install it:

- Android Chrome: menu -> Install app
- iPhone Safari: share button -> Add to Home Screen
