import { useCallback, useEffect, useMemo, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import Auth from './components/Auth';
import NoteEditor from './components/NoteEditor';
import NoteList from './components/NoteList';
import { supabase } from './lib/supabase';
import { Note, SaveStatus } from './types/note';

function createLocalNote(userId: string): Note {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    title: 'Untitled',
    content: '',
    is_pinned: false,
    is_archived: false,
    deleted_at: null,
    created_at: now,
    updated_at: now
  };
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const selectedNote = useMemo(() => {
    return notes.find((note) => note.id === selectedNoteId) ?? null;
  }, [notes, selectedNoteId]);

  const filteredNotes = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return notes
      .filter((note) => {
        if (!keyword) return true;
        return `${note.title} ${note.content}`.toLowerCase().includes(keyword);
      })
      .sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
  }, [notes, searchTerm]);

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

    const nextNotes = data ?? [];
    setNotes(nextNotes);

    if (!selectedNoteId && nextNotes.length > 0) {
      setSelectedNoteId(nextNotes[0].id);
    }
  }, [session?.user.id, selectedNoteId]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setNotes([]);
        setSelectedNoteId(null);
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchNotes();
  }, [session, fetchNotes]);

  useEffect(() => {
    function handleFocus() {
      fetchNotes();
    }

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [fetchNotes]);

  async function handleCreateNote() {
    if (!session?.user.id) return;

    setErrorMessage('');
    const optimisticNote = createLocalNote(session.user.id);
    setNotes((prev) => [optimisticNote, ...prev]);
    setSelectedNoteId(optimisticNote.id);

    const { data, error } = await supabase
      .from('notes')
      .insert({
        user_id: session.user.id,
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
    <div className="app-shell">
      <NoteList
        notes={filteredNotes}
        selectedNoteId={selectedNoteId}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onSelectNote={(note) => setSelectedNoteId(note.id)}
        onCreateNote={handleCreateNote}
        onTogglePin={handleTogglePin}
        onDeleteNote={handleDeleteNote}
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
          saveStatus={saveStatus}
          onUpdateNote={handleUpdateNote}
        />
      </main>
    </div>
  );
}
