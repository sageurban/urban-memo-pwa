# Urban Memo PWA

React + Vite + Supabase 기반의 개인용 Mac/iPhone 연동 메모장입니다.

## Included features

- Supabase Magic Link login
- Folder creation
- Nested folders
- Folder color editing
- Folder collapse / expand controls
- Collapse all / expand all folder tree controls
- Move folders into other folders or back to top level
- Move notes into another folder or Unfiled
- Rich text memo editor
- Text color changes inside notes
- Text size changes inside notes
- MP3 upload, playback, and deletion per note
- PWA install support

## Update notes

This version does not require a new SQL migration if you already applied the previous nested-folder version.
It uses the existing `folders.parent_id`, `folders.color`, and `notes.folder_id` columns.

If you have not applied the previous folder/MP3/nested-folder SQL yet, run `supabase/schema.sql` in Supabase SQL Editor.

## Local setup

Create `.env` in the project root:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Install and run:

```bash
npm install
npm run dev
```

Build check:

```bash
npm run build
```

## Deploy

Push to GitHub and redeploy on Vercel.
Make sure Vercel has these environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
