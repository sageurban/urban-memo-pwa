# Urban Memo PWA

Personal synced memo app built with React, Vite, Supabase, and PWA support.

## Features

- Supabase email Magic Link login
- Create, edit, pin, delete notes
- Create folders and collect notes by folder
- Attach MP3 files inside notes
- Private Supabase Storage bucket for MP3 files
- Search notes
- PWA install support for iPhone and desktop browsers

## Setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env` and fill in:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

3. Run `supabase/schema.sql` in Supabase Dashboard > SQL Editor.
4. Install and run:

```bash
npm install
npm run dev
```

5. Build:

```bash
npm run build
```

## Supabase Storage

The schema creates a private bucket named `note-audio`. MP3 files are stored under:

```text
{user_id}/{note_id}/{file_id}-{file_name}.mp3
```

The RLS policies allow each logged-in user to access only files inside their own user-id folder.
