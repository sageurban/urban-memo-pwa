import { useCallback, useEffect, useMemo, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import Auth from './components/Auth';
import NoteEditor from './components/NoteEditor';
import NoteList from './components/NoteList';
import MusicDashboard from './components/MusicDashboard';
import ChordTransposeWidget from './components/ChordTransposeWidget';
import { supabase } from './lib/supabase';
import { AudioFile, AudioMarker, Folder, Note, SaveStatus } from './types/note';
import { AdvancedFilters, defaultMetadataForTypes, defaultTitleForTypes, EMPTY_ADVANCED_FILTERS, MusicMetadata, normalizeTemplateTypes, NoteType, splitTags, templateContentForTypes } from './lib/musicTemplates';

type FolderFilter = 'all' | 'unfiled' | string;

const AUDIO_BUCKET = 'note-audio';
const SIGNED_URL_EXPIRES_IN = 60 * 60 * 24;
const DEFAULT_FOLDER_COLOR = '#f4f0e8';

function createLocalNote(userId: string, folderId: string | null, noteTypes: NoteType | NoteType[] = 'general'): Note {
  const now = new Date().toISOString();
  const selectedTypes = normalizeTemplateTypes(noteTypes);
  const primaryType = selectedTypes[0];
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    folder_id: folderId,
    note_type: primaryType,
    metadata: defaultMetadataForTypes(selectedTypes),
    title: defaultTitleForTypes(selectedTypes),
    content: templateContentForTypes(selectedTypes),
    is_pinned: false,
    is_archived: false,
    deleted_at: null,
    created_at: now,
    updated_at: now
  };
}

function createLocalFolder(userId: string, name: string, color: string, parentId: string | null): Folder {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    parent_id: parentId,
    name,
    color: color || DEFAULT_FOLDER_COLOR,
    created_at: now,
    updated_at: now
  };
}

function isMp3File(file: File) {
  const lowerName = file.name.toLowerCase();
  return file.type === 'audio/mpeg' || file.type === 'audio/mp3' || lowerName.endsWith('.mp3');
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);
}

function stripHtml(value: string) {
  if (!value) return '';
  const element = document.createElement('div');
  element.innerHTML = value;
  return element.textContent ?? '';
}

function includesText(value: unknown, filter: string) {
  if (!filter.trim()) return true;
  return String(value ?? '').toLowerCase().includes(filter.trim().toLowerCase());
}

function matchesAdvancedFilters(note: Note, filters: AdvancedFilters) {
  const metadata = note.metadata ?? {};
  if (!includesText(metadata.genre, filters.genre)) return false;
  if (!includesText(metadata.mood, filters.mood)) return false;
  if (!includesText(metadata.section, filters.section)) return false;
  if (!includesText(metadata.key, filters.key)) return false;
  if (!includesText(metadata.harmony, filters.harmony)) return false;
  if (!includesText(metadata.instrument, filters.instrument)) return false;
  if (filters.confidence && metadata.confidence !== filters.confidence) return false;

  const bpmValue = Number(String(metadata.bpm ?? '').replace(/[^0-9.]/g, ''));
  const minBpm = Number(filters.bpmMin);
  const maxBpm = Number(filters.bpmMax);

  if (filters.bpmMin && (!Number.isFinite(bpmValue) || bpmValue < minBpm)) return false;
  if (filters.bpmMax && (!Number.isFinite(bpmValue) || bpmValue > maxBpm)) return false;

  if (filters.tag.trim()) {
    const wanted = filters.tag.trim().replace(/^#/, '').toLowerCase();
    const tags = splitTags(metadata.tags).map((tag) => tag.replace(/^#/, '').toLowerCase());
    const metadataText = Object.values(metadata).join(' ').toLowerCase();
    if (!tags.some((tag) => tag.includes(wanted)) && !metadataText.includes(wanted)) return false;
  }

  return true;
}


function collectFolderAndDescendantIds(folderId: string, folders: Folder[]) {
  const ids = new Set<string>([folderId]);
  let changed = true;

  while (changed) {
    changed = false;
    folders.forEach((folder) => {
      if (folder.parent_id && ids.has(folder.parent_id) && !ids.has(folder.id)) {
        ids.add(folder.id);
        changed = true;
      }
    });
  }

  return ids;
}

async function attachSignedUrls(files: AudioFile[]): Promise<AudioFile[]> {
  if (files.length === 0) return [];

  const signedFiles = await Promise.all(
    files.map(async (file) => {
      const { data, error } = await supabase.storage
        .from(AUDIO_BUCKET)
        .createSignedUrl(file.file_path, SIGNED_URL_EXPIRES_IN);

      if (error) return file;
      return { ...file, signed_url: data.signedUrl };
    })
  );

  return signedFiles;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [audioMarkers, setAudioMarkers] = useState<AudioMarker[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<FolderFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | NoteType>('all');
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(EMPTY_ADVANCED_FILTERS);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [audioUploadStatus, setAudioUploadStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [mobileView, setMobileView] = useState<'folders' | 'editor'>('folders');
  const [mainView, setMainView] = useState<'library' | 'dashboard' | 'tools' | 'settings'>('library');
  const [searchFocusSignal, setSearchFocusSignal] = useState(0);
  const [chordToolSeed, setChordToolSeed] = useState('');
  const [chordToolOpenSignal, setChordToolOpenSignal] = useState(0);

  const selectedNote = useMemo(() => {
    return notes.find((note) => note.id === selectedNoteId) ?? null;
  }, [notes, selectedNoteId]);

  const selectedFolderScope = useMemo(() => {
    if (selectedFolderId === 'all' || selectedFolderId === 'unfiled') return null;
    return collectFolderAndDescendantIds(selectedFolderId, folders);
  }, [selectedFolderId, folders]);

  const filteredNotes = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return notes
      .filter((note) => {
        if (typeFilter !== 'all' && note.note_type !== typeFilter) return false;
        if (!matchesAdvancedFilters(note, advancedFilters)) return false;
        if (selectedFolderId === 'unfiled' && note.folder_id !== null) return false;
        if (selectedFolderScope && (!note.folder_id || !selectedFolderScope.has(note.folder_id))) return false;
        if (!keyword) return true;
        const metadataText = Object.values(note.metadata ?? {}).join(' ');
        return `${note.title} ${stripHtml(note.content)} ${metadataText} ${note.note_type}`.toLowerCase().includes(keyword);
      })
      .sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
  }, [notes, selectedFolderId, selectedFolderScope, searchTerm, typeFilter, advancedFilters]);

  const selectedNoteAudioFiles = useMemo(() => {
    if (!selectedNoteId) return [];
    return audioFiles.filter((file) => file.note_id === selectedNoteId);
  }, [audioFiles, selectedNoteId]);

  const selectedNoteAudioMarkers = useMemo(() => {
    if (!selectedNoteId) return [];
    return audioMarkers
      .filter((marker) => marker.note_id === selectedNoteId)
      .sort((a, b) => Number(a.time_seconds) - Number(b.time_seconds));
  }, [audioMarkers, selectedNoteId]);

  const fetchFolders = useCallback(async () => {
    if (!session?.user.id) return;

    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setFolders((data ?? []).map((folder) => ({
      ...folder,
      parent_id: folder.parent_id ?? null,
      color: folder.color || DEFAULT_FOLDER_COLOR
    })));
  }, [session?.user.id]);

  const fetchAudioFiles = useCallback(async () => {
    if (!session?.user.id) return;

    const { data, error } = await supabase
      .from('audio_files')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const nextFiles = await attachSignedUrls(data ?? []);
    setAudioFiles(nextFiles);
  }, [session?.user.id]);


  const fetchAudioMarkers = useCallback(async () => {
    if (!session?.user.id) return;

    const { data, error } = await supabase
      .from('audio_markers')
      .select('*')
      .eq('user_id', session.user.id)
      .order('time_seconds', { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setAudioMarkers((data ?? []).map((marker) => ({
      ...marker,
      time_seconds: Number(marker.time_seconds),
      end_seconds: marker.end_seconds == null ? null : Number(marker.end_seconds),
      bar_count: marker.bar_count ?? null,
      energy: marker.energy ?? null,
      reusable_idea: marker.reusable_idea ?? '',
      caution: marker.caution ?? '',
      variation_idea: marker.variation_idea ?? ''
    })) as AudioMarker[]);
  }, [session?.user.id]);

  const fetchNotes = useCallback(async () => {
    if (!session?.user.id) return;

    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', session.user.id)
      .is('deleted_at', null)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const nextNotes = (data ?? []).map((note) => ({
      ...note,
      note_type: note.note_type ?? 'general',
      metadata: note.metadata ?? {}
    })) as Note[];
    setNotes(nextNotes);

    if (!selectedNoteId && nextNotes.length > 0) {
      setSelectedNoteId(nextNotes[0].id);
    }
  }, [session?.user.id, selectedNoteId]);

  const refreshWorkspace = useCallback(async () => {
    await Promise.all([fetchFolders(), fetchNotes(), fetchAudioFiles(), fetchAudioMarkers()]);
  }, [fetchFolders, fetchNotes, fetchAudioFiles, fetchAudioMarkers]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setFolders([]);
        setNotes([]);
        setAudioFiles([]);
        setAudioMarkers([]);
        setSelectedNoteId(null);
        setSelectedFolderId('all');
        setMobileView('folders');
        setMainView('library');
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    refreshWorkspace();
  }, [session, refreshWorkspace]);

  useEffect(() => {
    function handleFocus() {
      refreshWorkspace();
    }

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [refreshWorkspace]);

  useEffect(() => {
    if (!selectedNoteId) return;
    if (filteredNotes.some((note) => note.id === selectedNoteId)) return;
    setSelectedNoteId(filteredNotes[0]?.id ?? null);
  }, [filteredNotes, selectedNoteId]);

  async function handleCreateFolder(name: string, color: string, parentId: string | null) {
    if (!session?.user.id) return;

    setErrorMessage('');
    const optimisticFolder = createLocalFolder(session.user.id, name, color, parentId);
    setFolders((prev) => [...prev, optimisticFolder]);
    setSelectedFolderId(optimisticFolder.id);

    const { data, error } = await supabase
      .from('folders')
      .insert({ user_id: session.user.id, name, color: color || DEFAULT_FOLDER_COLOR, parent_id: parentId })
      .select('*')
      .single();

    if (error) {
      setErrorMessage(error.message);
      setFolders((prev) => prev.filter((folder) => folder.id !== optimisticFolder.id));
      setSelectedFolderId('all');
      return;
    }

    setFolders((prev) => prev.map((folder) => (folder.id === optimisticFolder.id ? data : folder)));
    setSelectedFolderId(data.id);
  }

  async function handleUpdateFolder(folder: Folder, values: Partial<Pick<Folder, 'name' | 'color' | 'parent_id'>>) {
    setErrorMessage('');
    const now = new Date().toISOString();
    const nextValues = { ...values, updated_at: now };

    setFolders((prev) =>
      prev.map((item) => (item.id === folder.id ? { ...item, ...values, updated_at: now } : item))
    );

    const { error } = await supabase
      .from('folders')
      .update(nextValues)
      .eq('id', folder.id);

    if (error) {
      setErrorMessage(error.message);
      refreshWorkspace();
    }
  }

  async function handleDeleteFolder(folder: Folder) {
    const ok = window.confirm(
      `Delete folder "${folder.name}"?\n직접 들어있는 메모는 Unfiled로 이동됩니다. 하위 폴더는 최상위 폴더로 이동됩니다.`
    );
    if (!ok) return;

    setErrorMessage('');
    setFolders((prev) =>
      prev
        .filter((item) => item.id !== folder.id)
        .map((item) => (item.parent_id === folder.id ? { ...item, parent_id: null } : item))
    );
    setNotes((prev) => prev.map((note) => (note.folder_id === folder.id ? { ...note, folder_id: null } : note)));
    if (selectedFolderId === folder.id) setSelectedFolderId('all');

    const { error } = await supabase.from('folders').delete().eq('id', folder.id);

    if (error) {
      setErrorMessage(error.message);
      refreshWorkspace();
    }
  }

  async function handleCreateNote(noteTypes: NoteType | NoteType[] = 'general') {
    if (!session?.user.id) return;

    setErrorMessage('');
    const folderId = selectedFolderId !== 'all' && selectedFolderId !== 'unfiled' ? selectedFolderId : null;
    const optimisticNote = createLocalNote(session.user.id, folderId, noteTypes);
    setNotes((prev) => [optimisticNote, ...prev]);
    setSelectedNoteId(optimisticNote.id);
    setMobileView('editor');
    setMainView('library');

    const { data, error } = await supabase
      .from('notes')
      .insert({
        user_id: session.user.id,
        folder_id: optimisticNote.folder_id,
        note_type: optimisticNote.note_type,
        metadata: optimisticNote.metadata,
        title: optimisticNote.title,
        content: optimisticNote.content
      })
      .select('*')
      .single();

    if (error) {
      setErrorMessage(error.message);
      setNotes((prev) => prev.filter((note) => note.id !== optimisticNote.id));
      return;
    }

    setNotes((prev) => prev.map((note) => (note.id === optimisticNote.id ? data : note)));
    setSelectedNoteId(data.id);
    setMobileView('editor');
    setMainView('library');
  }

  const handleUpdateNote = useCallback(async (noteId: string, values: Pick<Note, 'title' | 'content'>) => {
    setSaveStatus('saving');
    setErrorMessage('');

    const now = new Date().toISOString();
    setNotes((prev) =>
      prev.map((note) =>
        note.id === noteId ? { ...note, ...values, updated_at: now } : note
      )
    );

    const { error } = await supabase
      .from('notes')
      .update({ ...values, updated_at: now })
      .eq('id', noteId);

    if (error) {
      setSaveStatus('error');
      setErrorMessage(error.message);
      return;
    }

    setSaveStatus('saved');
    window.setTimeout(() => setSaveStatus('idle'), 1200);
  }, []);

  const handleUpdateNoteMeta = useCallback(async (noteId: string, metadata: MusicMetadata) => {
    setSaveStatus('saving');
    setErrorMessage('');
    const now = new Date().toISOString();

    setNotes((prev) =>
      prev.map((note) =>
        note.id === noteId ? { ...note, metadata, updated_at: now } : note
      )
    );

    const { error } = await supabase
      .from('notes')
      .update({ metadata, updated_at: now })
      .eq('id', noteId);

    if (error) {
      setSaveStatus('error');
      setErrorMessage(error.message);
      return;
    }

    setSaveStatus('saved');
    window.setTimeout(() => setSaveStatus('idle'), 1200);
  }, []);

  async function handleChangeNoteFolder(noteId: string, folderId: string | null) {
    setErrorMessage('');
    const now = new Date().toISOString();

    setNotes((prev) =>
      prev.map((note) =>
        note.id === noteId ? { ...note, folder_id: folderId, updated_at: now } : note
      )
    );

    const { error } = await supabase
      .from('notes')
      .update({ folder_id: folderId, updated_at: now })
      .eq('id', noteId);

    if (error) {
      setErrorMessage(error.message);
      refreshWorkspace();
    }
  }

  async function handleTogglePin(note: Note) {
    setErrorMessage('');
    const nextPinned = !note.is_pinned;

    setNotes((prev) =>
      prev.map((item) =>
        item.id === note.id ? { ...item, is_pinned: nextPinned } : item
      )
    );

    const { error } = await supabase
      .from('notes')
      .update({ is_pinned: nextPinned, updated_at: new Date().toISOString() })
      .eq('id', note.id);

    if (error) {
      setErrorMessage(error.message);
      setNotes((prev) =>
        prev.map((item) =>
          item.id === note.id ? { ...item, is_pinned: note.is_pinned } : item
        )
      );
    }
  }

  async function handleDeleteNote(note: Note) {
    setErrorMessage('');
    const deletedAt = new Date().toISOString();

    setNotes((prev) => prev.filter((item) => item.id !== note.id));
    setAudioMarkers((prev) => prev.filter((marker) => marker.note_id !== note.id));
    if (selectedNoteId === note.id) setSelectedNoteId(null);

    const { error } = await supabase
      .from('notes')
      .update({ deleted_at: deletedAt, updated_at: deletedAt })
      .eq('id', note.id);

    if (error) {
      setErrorMessage(error.message);
      fetchNotes();
    }
  }

  async function handleUploadAudio(note: Note, file: File) {
    if (!session?.user.id) return;

    setErrorMessage('');
    setAudioUploadStatus('');

    if (!isMp3File(file)) {
      setAudioUploadStatus('MP3 파일만 업로드할 수 있습니다.');
      return;
    }

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      setAudioUploadStatus('파일 크기는 50MB 이하로 업로드해주세요.');
      return;
    }

    setAudioUploadStatus('Uploading MP3...');

    const safeName = sanitizeFileName(file.name || 'audio.mp3');
    const filePath = `${session.user.id}/${note.id}/${crypto.randomUUID()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(filePath, file, {
        contentType: file.type || 'audio/mpeg',
        upsert: false
      });

    if (uploadError) {
      setErrorMessage(uploadError.message);
      setAudioUploadStatus('MP3 업로드에 실패했습니다.');
      return;
    }

    const { data, error: insertError } = await supabase
      .from('audio_files')
      .insert({
        user_id: session.user.id,
        note_id: note.id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type || 'audio/mpeg'
      })
      .select('*')
      .single();

    if (insertError) {
      await supabase.storage.from(AUDIO_BUCKET).remove([filePath]);
      setErrorMessage(insertError.message);
      setAudioUploadStatus('MP3 메타데이터 저장에 실패했습니다.');
      return;
    }

    const [nextAudio] = await attachSignedUrls([data]);
    setAudioFiles((prev) => [nextAudio, ...prev]);
    setAudioUploadStatus('MP3가 저장되었습니다.');
    window.setTimeout(() => setAudioUploadStatus(''), 1800);
  }

  async function handleDeleteAudio(audioFile: AudioFile) {
    const ok = window.confirm(`Delete "${audioFile.file_name}"?`);
    if (!ok) return;

    setErrorMessage('');
    setAudioFiles((prev) => prev.filter((file) => file.id !== audioFile.id));

    const { error: storageError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .remove([audioFile.file_path]);

    const { error: dbError } = await supabase
      .from('audio_files')
      .delete()
      .eq('id', audioFile.id);

    if (storageError || dbError) {
      setErrorMessage(storageError?.message ?? dbError?.message ?? 'Failed to delete MP3');
      fetchAudioFiles();
    }
  }


  async function handleCreateAudioMarker(values: {
    note_id: string;
    audio_file_id: string | null;
    time_seconds: number;
    end_seconds: number | null;
    section_name: string;
    marker_type: string;
    title: string;
    description: string;
    chord_progression: string;
    bar_count: number | null;
    energy: number | null;
    reusable_idea: string;
    caution: string;
    variation_idea: string;
  }) {
    if (!session?.user.id) return;

    setErrorMessage('');
    const now = new Date().toISOString();
    const optimisticMarker: AudioMarker = {
      id: crypto.randomUUID(),
      user_id: session.user.id,
      note_id: values.note_id,
      audio_file_id: values.audio_file_id,
      time_seconds: Number(values.time_seconds) || 0,
      end_seconds: values.end_seconds == null ? null : Number(values.end_seconds),
      section_name: values.section_name,
      marker_type: values.marker_type,
      title: values.title,
      description: values.description,
      chord_progression: values.chord_progression,
      bar_count: values.bar_count,
      energy: values.energy,
      reusable_idea: values.reusable_idea,
      caution: values.caution,
      variation_idea: values.variation_idea,
      created_at: now,
      updated_at: now
    };

    setAudioMarkers((prev) => [...prev, optimisticMarker]);

    const { data, error } = await supabase
      .from('audio_markers')
      .insert({
        user_id: session.user.id,
        note_id: values.note_id,
        audio_file_id: values.audio_file_id,
        time_seconds: values.time_seconds,
        end_seconds: values.end_seconds,
        section_name: values.section_name,
        marker_type: values.marker_type,
        title: values.title,
        description: values.description,
        chord_progression: values.chord_progression,
        bar_count: values.bar_count,
        energy: values.energy,
        reusable_idea: values.reusable_idea,
        caution: values.caution,
        variation_idea: values.variation_idea
      })
      .select('*')
      .single();

    if (error) {
      setErrorMessage(error.message);
      setAudioMarkers((prev) => prev.filter((marker) => marker.id !== optimisticMarker.id));
      return;
    }

    setAudioMarkers((prev) =>
      prev.map((marker) =>
        marker.id === optimisticMarker.id
          ? {
              ...data,
              time_seconds: Number(data.time_seconds),
              end_seconds: data.end_seconds == null ? null : Number(data.end_seconds),
              bar_count: data.bar_count ?? null,
              energy: data.energy ?? null,
              reusable_idea: data.reusable_idea ?? '',
              caution: data.caution ?? '',
              variation_idea: data.variation_idea ?? ''
            }
          : marker
      )
    );
  }

  async function handleUpdateAudioMarker(markerId: string, values: Partial<Pick<AudioMarker, 'audio_file_id' | 'time_seconds' | 'end_seconds' | 'section_name' | 'marker_type' | 'title' | 'description' | 'chord_progression' | 'bar_count' | 'energy' | 'reusable_idea' | 'caution' | 'variation_idea'>>) {
    setErrorMessage('');
    const now = new Date().toISOString();

    setAudioMarkers((prev) =>
      prev.map((marker) =>
        marker.id === markerId
          ? { ...marker, ...values, time_seconds: values.time_seconds ?? marker.time_seconds, updated_at: now }
          : marker
      )
    );

    const { error } = await supabase
      .from('audio_markers')
      .update({ ...values, updated_at: now })
      .eq('id', markerId);

    if (error) {
      setErrorMessage(error.message);
      fetchAudioMarkers();
    }
  }

  async function handleDeleteAudioMarker(marker: AudioMarker) {
    const ok = window.confirm(`Delete marker "${marker.title || marker.section_name || marker.marker_type}"?`);
    if (!ok) return;

    setErrorMessage('');
    setAudioMarkers((prev) => prev.filter((item) => item.id !== marker.id));

    const { error } = await supabase
      .from('audio_markers')
      .delete()
      .eq('id', marker.id);

    if (error) {
      setErrorMessage(error.message);
      fetchAudioMarkers();
    }
  }


  async function handleSaveTransposedChordNote(payload: {
    originalKey: string;
    targetKey: string;
    originalProgression: string;
    transposedProgression: string;
    content: string;
  }) {
    if (!session?.user.id) return;

    setErrorMessage('');
    const now = new Date().toISOString();
    const optimisticNote: Note = {
      id: crypto.randomUUID(),
      user_id: session.user.id,
      folder_id: selectedFolderId !== 'all' && selectedFolderId !== 'unfiled' ? selectedFolderId : null,
      note_type: 'chord_progression',
      metadata: {
        key: payload.targetKey,
        section: 'Chorus',
        instrument: 'Keys',
        confidence: 'Medium',
        tags: 'transpose, chord progression',
        source: `Transposed from ${payload.originalKey}`
      },
      title: `Transposed Chord Idea - ${payload.targetKey}`,
      content: payload.content,
      is_pinned: false,
      is_archived: false,
      deleted_at: null,
      created_at: now,
      updated_at: now
    };

    setNotes((prev) => [optimisticNote, ...prev]);
    setSelectedNoteId(optimisticNote.id);
    setMobileView('editor');
    setMainView('library');

    const { data, error } = await supabase
      .from('notes')
      .insert({
        user_id: session.user.id,
        folder_id: optimisticNote.folder_id,
        note_type: optimisticNote.note_type,
        metadata: optimisticNote.metadata,
        title: optimisticNote.title,
        content: optimisticNote.content
      })
      .select('*')
      .single();

    if (error) {
      setErrorMessage(error.message);
      setNotes((prev) => prev.filter((note) => note.id !== optimisticNote.id));
      return;
    }

    setNotes((prev) => prev.map((note) => (note.id === optimisticNote.id ? { ...data, note_type: data.note_type ?? 'general', metadata: data.metadata ?? {} } as Note : note)));
    setSelectedNoteId(data.id);
    setMainView('library');
  }


  function handleInsertChordIntoCurrentNote(payload: {
    transposedProgression: string;
    fullAnalysis: string;
    songSection: string;
  }) {
    if (!selectedNote) {
      setErrorMessage('먼저 코드를 삽입할 메모를 선택해주세요.');
      setMainView('library');
      setMobileView('folders');
      return;
    }

    const html = `
      <section><strong>Chord Transpose Result</strong><br>${payload.songSection.replace(/\n/g, '<br>')}<br><br>${payload.fullAnalysis.replace(/\n/g, '<br>')}</section>
    `;
    const nextContent = `${selectedNote.content || ''}${selectedNote.content ? '<br><br>' : ''}${html}`;
    handleUpdateNote(selectedNote.id, { title: selectedNote.title, content: nextContent });
    setMainView('library');
    setMobileView('editor');
  }

  function applyDashboardFilters(nextFilters: Partial<AdvancedFilters>, nextTypeFilter: 'all' | NoteType = 'all') {
    setAdvancedFilters((current) => ({ ...current, ...nextFilters }));
    setTypeFilter(nextTypeFilter);
    setMainView('library');
    setMobileView('folders');
  }

  function clearAllFilters() {
    setAdvancedFilters(EMPTY_ADVANCED_FILTERS);
    setTypeFilter('all');
    setSearchTerm('');
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return <div className="loading-screen">Loading Urban Memo...</div>;
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className={`app-shell main-view-${mainView} mobile-view-${mobileView}`}>
      <NoteList
        notes={filteredNotes}
        allNotes={notes}
        folders={folders}
        selectedNoteId={selectedNoteId}
        selectedFolderId={selectedFolderId}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onSelectFolder={setSelectedFolderId}
        onCreateFolder={handleCreateFolder}
        onUpdateFolder={handleUpdateFolder}
        onDeleteFolder={handleDeleteFolder}
        onSelectNote={(note) => {
          setSelectedNoteId(note.id);
          setMobileView('editor');
          setMainView('library');
        }}
        onCreateNote={handleCreateNote}
        onTogglePin={handleTogglePin}
        onChangeNoteFolder={handleChangeNoteFolder}
        onDeleteNote={handleDeleteNote}
        searchFocusSignal={searchFocusSignal}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        advancedFilters={advancedFilters}
        onAdvancedFiltersChange={setAdvancedFilters}
        onClearAdvancedFilters={clearAllFilters}
      />

      <main className="main-panel">
        <header className="top-bar app-top-bar-v5">
          <div>
            <strong>{session.user.email}</strong>
            <span>{mainView === 'library' ? 'Library workspace' : mainView === 'dashboard' ? 'Dashboard explorer' : mainView === 'tools' ? 'Composition tools' : 'Settings'}</span>
          </div>

          <nav className="main-view-tabs" aria-label="Main workspace views">
            <button type="button" className={mainView === 'library' ? 'active' : ''} onClick={() => setMainView('library')}>Library</button>
            <button type="button" className={mainView === 'dashboard' ? 'active' : ''} onClick={() => setMainView('dashboard')}>Dashboard</button>
            <button type="button" className={mainView === 'tools' ? 'active' : ''} onClick={() => {
              setMainView('tools');
              setChordToolOpenSignal((value) => value + 1);
            }}>Tools</button>
          </nav>

          <button type="button" className="ghost-button" onClick={handleLogout}>
            Logout
          </button>
        </header>

        {errorMessage && <div className="error-banner">{errorMessage}</div>}

        {mainView === 'dashboard' && (
          <section className="workspace-view dashboard-view">
            <div className="workspace-view-header">
              <div>
                <strong>Dashboard</strong>
                <span>쌓인 음악 데이터를 클릭해서 바로 라이브러리 필터로 이동하세요.</span>
              </div>
              <button type="button" onClick={clearAllFilters}>Clear Filters</button>
            </div>
            <MusicDashboard
              notes={notes}
              audioFiles={audioFiles}
              audioMarkers={audioMarkers}
              onApplyFilters={applyDashboardFilters}
              onOpenChordTool={(progression) => {
                if (progression) setChordToolSeed(progression);
                setChordToolOpenSignal((value) => value + 1);
                setMainView('tools');
              }}
            />
          </section>
        )}

        {mainView === 'tools' && (
          <section className="workspace-view tools-view">
            <div className="workspace-view-header">
              <div>
                <strong>Tools</strong>
                <span>코드 조옮김 도구를 메모와 분리해 항상 사용할 수 있게 정리했습니다.</span>
              </div>
              <button type="button" onClick={() => setChordToolOpenSignal((value) => value + 1)}>Open Chord Tool</button>
            </div>
            <div className="tools-page-grid">
              <article>
                <b>Chord Transpose Widget</b>
                <p>진행을 입력하고 목표 Key를 선택하면 곧바로 조옮김됩니다.</p>
                <button type="button" onClick={() => setChordToolOpenSignal((value) => value + 1)}>Open Floating Widget</button>
              </article>
              <article>
                <b>Insert to Current Note</b>
                <p>조옮김 결과를 현재 선택된 메모 본문에 바로 삽입할 수 있습니다.</p>
              </article>
              <article>
                <b>Copy Formats</b>
                <p>Chord only, Full analysis, Song section 형식으로 복사할 수 있습니다.</p>
              </article>
            </div>
          </section>
        )}

        {mainView === 'settings' && (
          <section className="workspace-view settings-view">
            <div className="workspace-view-header">
              <div>
                <strong>Settings</strong>
                <span>현재는 로그아웃과 동기화 상태 확인 중심으로 정리했습니다.</span>
              </div>
            </div>
            <div className="settings-card-v5">
              <strong>Sync Status</strong>
              <p>Supabase와 연결된 개인 라이브러리입니다. 모든 변경은 자동 저장됩니다.</p>
              <button type="button" onClick={handleLogout}>Logout</button>
            </div>
          </section>
        )}

        {mainView === 'library' && (
          <NoteEditor
            note={selectedNote}
            folders={folders}
            audioFiles={selectedNoteAudioFiles}
            audioMarkers={selectedNoteAudioMarkers}
            saveStatus={saveStatus}
            audioUploadStatus={audioUploadStatus}
            onUpdateNote={handleUpdateNote}
            onUpdateNoteMeta={handleUpdateNoteMeta}
            onChangeNoteFolder={handleChangeNoteFolder}
            onUploadAudio={handleUploadAudio}
            onDeleteAudio={handleDeleteAudio}
            onCreateAudioMarker={handleCreateAudioMarker}
            onUpdateAudioMarker={handleUpdateAudioMarker}
            onDeleteAudioMarker={handleDeleteAudioMarker}
            onTogglePin={handleTogglePin}
            onDeleteNote={handleDeleteNote}
            onBackToList={() => setMobileView('folders')}
          />
        )}
      </main>

      <ChordTransposeWidget
        seedProgression={chordToolSeed}
        openSignal={chordToolOpenSignal}
        onSaveTransposedChordNote={handleSaveTransposedChordNote}
        onInsertIntoCurrentNote={handleInsertChordIntoCurrentNote}
      />

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <button type="button" className={mainView === 'library' && mobileView === 'folders' ? 'active' : ''} onClick={() => {
          setMainView('library');
          setMobileView('folders');
        }}>
          <span>▣</span>
          <em>Library</em>
        </button>
        <button type="button" className={mainView === 'dashboard' ? 'active' : ''} onClick={() => setMainView('dashboard')}>
          <span>◫</span>
          <em>Dashboard</em>
        </button>
        <button type="button" className="center-action" onClick={() => handleCreateNote()}>
          +
        </button>
        <button type="button" className={mainView === 'tools' ? 'active' : ''} onClick={() => {
          setMainView('tools');
          setChordToolOpenSignal((value) => value + 1);
        }}>
          <span>♬</span>
          <em>Tools</em>
        </button>
        <button type="button" className={mainView === 'settings' ? 'active' : ''} onClick={() => setMainView('settings')}>
          <span>⚙</span>
          <em>Settings</em>
        </button>
      </nav>
    </div>
  );
}
