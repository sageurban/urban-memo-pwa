-- Urban Memo Supabase schema
-- Run this in Supabase Dashboard > SQL Editor.
-- Includes notes, nested folders with colors, rich text content, MP3 metadata, and private Supabase Storage policies.

create extension if not exists pgcrypto;

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.folders(id) on delete set null,
  name text not null,
  color text not null default '#f4f0e8',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.folders
add column if not exists parent_id uuid references public.folders(id) on delete set null;

alter table public.folders
add column if not exists color text not null default '#f4f0e8';

alter table public.folders
alter column color set default '#f4f0e8';

update public.folders
set color = '#f4f0e8'
where color is null or color = '';

-- Older starter versions used unique(user_id, name), which blocks same folder names under different parents.
alter table public.folders
  drop constraint if exists folders_user_id_name_key;

create unique index if not exists folders_user_parent_name_unique_idx
on public.folders (user_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid references public.folders(id) on delete set null,
  title text not null default '',
  content text not null default '',
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notes
add column if not exists folder_id uuid references public.folders(id) on delete set null;

alter table public.notes
add column if not exists note_type text not null default 'general';

alter table public.notes
add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists notes_user_type_idx
on public.notes (user_id, note_type, updated_at desc);

create index if not exists notes_metadata_gin_idx
on public.notes using gin (metadata);

create table if not exists public.audio_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  created_at timestamptz not null default now(),
  unique (file_path)
);

create index if not exists folders_user_parent_idx
on public.folders (user_id, parent_id, name);

create index if not exists notes_user_updated_idx
on public.notes (user_id, is_pinned desc, updated_at desc);

create index if not exists notes_user_folder_idx
on public.notes (user_id, folder_id, updated_at desc);

create index if not exists audio_files_user_note_idx
on public.audio_files (user_id, note_id, created_at desc);

create table if not exists public.audio_markers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  audio_file_id uuid references public.audio_files(id) on delete set null,
  time_seconds numeric not null default 0,
  section_name text not null default '',
  marker_type text not null default 'Song Form',
  title text not null default '',
  description text not null default '',
  chord_progression text not null default '',
  bar_count integer,
  energy integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.audio_markers
add column if not exists audio_file_id uuid references public.audio_files(id) on delete set null;

alter table public.audio_markers
add column if not exists time_seconds numeric not null default 0;

alter table public.audio_markers
add column if not exists section_name text not null default '';

alter table public.audio_markers
add column if not exists marker_type text not null default 'Song Form';

alter table public.audio_markers
add column if not exists title text not null default '';

alter table public.audio_markers
add column if not exists description text not null default '';

alter table public.audio_markers
add column if not exists chord_progression text not null default '';

alter table public.audio_markers
add column if not exists bar_count integer;

alter table public.audio_markers
add column if not exists energy integer;

create index if not exists audio_markers_user_note_time_idx
on public.audio_markers (user_id, note_id, time_seconds asc);

create index if not exists audio_markers_user_audio_idx
on public.audio_markers (user_id, audio_file_id, time_seconds asc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists folders_set_updated_at on public.folders;
create trigger folders_set_updated_at
before update on public.folders
for each row
execute function public.set_updated_at();

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
before update on public.notes
for each row
execute function public.set_updated_at();

drop trigger if exists audio_markers_set_updated_at on public.audio_markers;
create trigger audio_markers_set_updated_at
before update on public.audio_markers
for each row
execute function public.set_updated_at();

alter table public.folders enable row level security;
alter table public.notes enable row level security;
alter table public.audio_files enable row level security;
alter table public.audio_markers enable row level security;

drop policy if exists "Users can read own folders" on public.folders;
create policy "Users can read own folders"
on public.folders
for select
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own folders" on public.folders;
create policy "Users can insert own folders"
on public.folders
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own folders" on public.folders;
create policy "Users can update own folders"
on public.folders
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own folders" on public.folders;
create policy "Users can delete own folders"
on public.folders
for delete
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own notes" on public.notes;
create policy "Users can read own notes"
on public.notes
for select
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own notes" on public.notes;
create policy "Users can insert own notes"
on public.notes
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own notes" on public.notes;
create policy "Users can update own notes"
on public.notes
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own notes" on public.notes;
create policy "Users can delete own notes"
on public.notes
for delete
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own audio metadata" on public.audio_files;
create policy "Users can read own audio metadata"
on public.audio_files
for select
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own audio metadata" on public.audio_files;
create policy "Users can insert own audio metadata"
on public.audio_files
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own audio metadata" on public.audio_files;
create policy "Users can update own audio metadata"
on public.audio_files
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own audio metadata" on public.audio_files;
create policy "Users can delete own audio metadata"
on public.audio_files
for delete
using ((select auth.uid()) = user_id);


drop policy if exists "Users can read own audio markers" on public.audio_markers;
create policy "Users can read own audio markers"
on public.audio_markers
for select
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own audio markers" on public.audio_markers;
create policy "Users can insert own audio markers"
on public.audio_markers
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own audio markers" on public.audio_markers;
create policy "Users can update own audio markers"
on public.audio_markers
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own audio markers" on public.audio_markers;
create policy "Users can delete own audio markers"
on public.audio_markers
for delete
using ((select auth.uid()) = user_id);

-- Private bucket for MP3 files attached to notes.
insert into storage.buckets (id, name, "public", file_size_limit, allowed_mime_types)
values (
  'note-audio',
  'note-audio',
  false,
  52428800,
  array['audio/mpeg', 'audio/mp3']
)
on conflict (id) do update
set
  "public" = excluded."public",
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage object paths are saved as: {user_id}/{note_id}/{file_id}-{file_name}.mp3
-- The first path folder must match the logged-in user id.
drop policy if exists "Users can read own audio objects" on storage.objects;
create policy "Users can read own audio objects"
on storage.objects
for select
using (
  bucket_id = 'note-audio'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can upload own audio objects" on storage.objects;
create policy "Users can upload own audio objects"
on storage.objects
for insert
with check (
  bucket_id = 'note-audio'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can update own audio objects" on storage.objects;
create policy "Users can update own audio objects"
on storage.objects
for update
using (
  bucket_id = 'note-audio'
  and (select auth.uid())::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'note-audio'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can delete own audio objects" on storage.objects;
create policy "Users can delete own audio objects"
on storage.objects
for delete
using (
  bucket_id = 'note-audio'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);
