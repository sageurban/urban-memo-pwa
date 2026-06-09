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

## Urban Music Library v3.2 — Audio Timeline Analysis v2

This update extends Audio Timeline Analysis with:

- Visual song-form timeline based on audio markers
- Marker type filter: All / Song Form / Chord / Rhythm / Arrangement / Sound Design, etc.
- Energy graph using each marker's energy value
- A-B Loop using marker start/end time
- End time field for markers
- Reusable Idea / Caution / Variation Idea fields for composition reuse

### Supabase SQL required

Run `supabase/schema.sql` again in Supabase SQL Editor. This update adds these columns to `audio_markers`:

```sql
end_seconds numeric
reusable_idea text
caution text
variation_idea text
```

Existing notes, audio files, and markers are preserved.
