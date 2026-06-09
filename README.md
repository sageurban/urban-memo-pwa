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


## Stage 4: Dashboard + Chord Transpose Tool

This version adds a music-data dashboard and a chord transpose utility.

### Included
- Library overview cards: total notes, audio markers, MP3 files, chord sources.
- Type usage dashboard.
- BPM distribution dashboard.
- Key usage dashboard.
- Genre top dashboard.
- Genre / mood matrix.
- Top tags.
- Section chord progression list.
- Chord Transpose Tool:
  - Original Key / Target Key
  - Slash chord support
  - 7th, 9th, add9, sus, dim, aug style suffix preservation
  - Copy result
  - Save as Chord Progression note

### Not included
- Harmonic Usage dashboard is intentionally excluded in this version.

### Supabase
No new SQL is required if Stage 1–3 SQL has already been applied.
This update uses existing `notes.metadata`, `notes.note_type`, `audio_files`, and `audio_markers`.


## Urban Music Library v5 - Navigation & Workflow Refinement

This update separates the workspace into Library, Dashboard, Tools, and Settings views.

### Added
- Top navigation tabs on desktop: Library / Dashboard / Tools
- Mobile bottom navigation updated: Library / Dashboard / + / Tools / Settings
- Dashboard is now a focused data explorer
- Chord Transpose is a floating utility widget, independent from Dashboard
- Chord Transpose improvements:
  - Copy Chords
  - Copy Full Analysis
  - Copy Song Section
  - Insert result into current note
  - Save as Chord Note
  - Recent transpose history
  - Remember recent original/target keys

### Supabase
No new SQL migration is required for this update.
