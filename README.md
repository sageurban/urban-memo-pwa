# Urban Memo PWA

Personal synced memo app for Mac + iPhone.

## Current features

- Supabase magic-link login
- Notes with auto-save
- Folder organization
- Nested folders / subfolders
- Folder name colors
- Rich text note body
  - selected text color
  - selected text size
- MP3 upload per note
- Private Supabase Storage bucket for MP3 files
- PWA install support

## Setup

1. Copy `.env.example` to `.env`.
2. Fill in:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

3. Run `supabase/schema.sql` in Supabase SQL Editor.
4. Install and run:

```bash
npm install
npm run dev
```

5. Build test:

```bash
npm run build
```

## Deploy

Push to GitHub, then deploy on Vercel.
Add the same environment variables to Vercel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

After deployment, add your Vercel URL to Supabase:

Authentication → URL Configuration → Site URL / Redirect URLs.

## Important

Do not upload `.env` to GitHub.
