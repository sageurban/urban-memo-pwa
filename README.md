# Urban Music Library v3 - Audio Timeline Analysis

Personal music analysis library built with React + Vite + Supabase.

## v3 features

- MP3 upload and playback
- Audio Timeline Analysis markers
- Add marker from current playback position
- Marker fields: time, section, type, title, description, chord progression, bars, energy
- Click marker time to jump audio playback to that position
- Edit and delete markers
- Existing folders, nested folders, templates, metadata, advanced filters, tags, rich text, and MP3 functions are kept

## Apply

1. Keep your existing `.env` file.
2. Replace the project files with this version.
3. Run the SQL in `supabase/schema.sql` in Supabase SQL Editor.
4. Build and deploy:

```bash
npm install
npm run build
git add .
git commit -m "Add audio timeline analysis v1"
git push
```

## Required Supabase update

This version adds `audio_markers` table and RLS policies. Run `supabase/schema.sql` once.
