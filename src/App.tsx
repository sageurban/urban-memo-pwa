import { useCallback, useEffect, useMemo, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import Auth from './components/Auth';
import NoteEditor from './components/NoteEditor';
import NoteList from './components/NoteList';
import { supabase } from './lib/supabase';
import { AudioFile, Folder, Note, SaveStatus } from './types/note';
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
  const [searchFocusSignal, setSearchFocusSignal] = useState(0);

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
    await Promise.all([fetchFolders(), fetchNotes(), fetchAudioFiles()]);
  }, [fetchFolders, fetchNotes, fetchAudioFiles]);

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
        setSelectedNoteId(null);
        setSelectedFolderId('all');
        setMobileView('folders');
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
    <div className={`app-shell mobile-view-${mobileView}`}>
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
        onClearAdvancedFilters={() => setAdvancedFilters(EMPTY_ADVANCED_FILTERS)}
      />

      <main className="main-panel">
        <header className="top-bar">
          <div>
            <strong>{session.user.email}</strong>
            <span>Private synced workspace</span>
          </div>
          <button type="button" className="ghost-button" onClick={handleLogout}>
            Logout
          </button>
        </header>

        {errorMessage && <div className="error-banner">{errorMessage}</div>}

        <NoteEditor
          note={selectedNote}
          folders={folders}
          audioFiles={selectedNoteAudioFiles}
          saveStatus={saveStatus}
          audioUploadStatus={audioUploadStatus}
          onUpdateNote={handleUpdateNote}
          onUpdateNoteMeta={handleUpdateNoteMeta}
          onChangeNoteFolder={handleChangeNoteFolder}
          onUploadAudio={handleUploadAudio}
          onDeleteAudio={handleDeleteAudio}
          onTogglePin={handleTogglePin}
          onDeleteNote={handleDeleteNote}
          onBackToList={() => setMobileView('folders')}
        />
      </main>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <button type="button" className={mobileView === 'folders' ? 'active' : ''} onClick={() => setMobileView('folders')}>
          <span>▣</span>
          <em>폴더</em>
        </button>
        <button type="button" className={mobileView === 'folders' ? 'active' : ''} onClick={() => setMobileView('folders')}>
          <span>✎</span>
          <em>메모</em>
        </button>
        <button type="button" className="center-action" onClick={() => handleCreateNote()}>
          +
        </button>
        <button type="button" onClick={() => {
          setMobileView('folders');
          setSearchFocusSignal((value) => value + 1);
        }}>
          <span>⌕</span>
          <em>검색</em>
        </button>
        <button type="button" className={mobileView === 'editor' ? 'active' : ''} onClick={() => setMobileView('editor')}>
          <span>▤</span>
          <em>편집</em>
        </button>
      </nav>
    </div>
  );
}
