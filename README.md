# Urban Music Library v1

Personal music analysis and production-idea library built on React + Vite + Supabase.

## New in v1

- Note type system
  - General Note
  - Song Analysis
  - Chord Progression
  - Rhythm Pattern
  - Sound Design
  - Lyrics / Hook Idea
  - My Demo Idea
- Type-based templates inserted automatically when creating a new note.
- Type badges on note cards.
- Type filter chips in the sidebar.
- Music metadata panel inside the editor.
  - Genre
  - BPM
  - Key
  - Mood
  - Section
  - Harmony
  - Instrument
  - Confidence
  - Tags
  - Source
- Search now includes title, content, note type, and metadata values.
- Existing features preserved:
  - folders / nested folders
  - folder colors
  - folder rename / move / collapse
  - rich text editor
  - MP3 upload and playback
  - mobile responsive UI

## Supabase migration

Run `supabase/schema.sql` again in Supabase SQL Editor.

This adds:

```sql
notes.note_type text default 'general'
notes.metadata jsonb default '{}'
```

Existing notes are preserved and automatically become `general` notes.

## Apply update

Copy these files into your existing project:

```text
src/App.tsx
src/components/NoteList.tsx
src/components/NoteEditor.tsx
src/lib/musicTemplates.ts
src/types/note.ts
src/styles.css
supabase/schema.sql
```

Keep your existing `.env` file.

Then run:

```bash
npm run build
git add .
git commit -m "Add Urban Music Library v1 templates and metadata"
git push
```


## Urban Music Library v2 - Advanced Filters

추가 기능:
- 고급 필터 패널
  - Genre
  - Mood
  - Section
  - Key
  - BPM Range
  - Harmony
  - Instrument
  - Confidence
  - Tag
- Active filter chips
- BPM preset buttons
- Metadata 기반 검색/필터링
- 메모 카드에 metadata badge/tag 표시
- 태그 클릭 시 tag filter 적용
- NoteEditor에서 태그를 Enter로 추가하고 클릭으로 삭제

SQL:
- 기존 `notes.metadata` jsonb 컬럼을 사용합니다.
- 이미 v1에서 metadata 컬럼을 추가했다면 추가 SQL 실행은 필요 없습니다.
