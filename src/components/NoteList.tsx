import { FormEvent, useMemo, useState } from 'react';
import { Folder, Note } from '../types/note';

type FolderFilter = 'all' | 'unfiled' | string;

type NoteListProps = {
  notes: Note[];
  folders: Folder[];
  selectedNoteId: string | null;
  selectedFolderId: FolderFilter;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSelectFolder: (folderId: FolderFilter) => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (folder: Folder) => void;
  onSelectNote: (note: Note) => void;
  onCreateNote: () => void;
  onTogglePin: (note: Note) => void;
  onDeleteNote: (note: Note) => void;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

export default function NoteList({
  notes,
  folders,
  selectedNoteId,
  selectedFolderId,
  searchTerm,
  onSearchTermChange,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  onSelectNote,
  onCreateNote,
  onTogglePin,
  onDeleteNote
}: NoteListProps) {
  const [newFolderName, setNewFolderName] = useState('');

  const noteCountByFolder = useMemo(() => {
    return notes.reduce<Record<string, number>>((acc, note) => {
      const key = note.folder_id ?? 'unfiled';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }, [notes]);

  const unfiledCount = noteCountByFolder.unfiled ?? 0;

  function handleCreateFolder(event: FormEvent) {
    event.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    onCreateFolder(name);
    setNewFolderName('');
  }

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <div>
          <h1>Urban Memo</h1>
          <p>{notes.length} notes</p>
        </div>
        <button type="button" className="new-button" onClick={onCreateNote}>
          +
        </button>
      </header>

      <section className="folder-panel" aria-label="Folders">
        <div className="folder-panel-header">
          <strong>Folders</strong>
          <span>{folders.length}</span>
        </div>

        <button
          type="button"
          className={`folder-row ${selectedFolderId === 'all' ? 'active' : ''}`}
          onClick={() => onSelectFolder('all')}
        >
          <span>All Notes</span>
          <em>{notes.length}</em>
        </button>

        <button
          type="button"
          className={`folder-row ${selectedFolderId === 'unfiled' ? 'active' : ''}`}
          onClick={() => onSelectFolder('unfiled')}
        >
          <span>Unfiled</span>
          <em>{unfiledCount}</em>
        </button>

        {folders.map((folder) => (
          <div className="folder-row-wrap" key={folder.id}>
            <button
              type="button"
              className={`folder-row ${selectedFolderId === folder.id ? 'active' : ''}`}
              onClick={() => onSelectFolder(folder.id)}
            >
              <span>{folder.name}</span>
              <em>{noteCountByFolder[folder.id] ?? 0}</em>
            </button>
            <button
              type="button"
              className="folder-delete"
              onClick={() => onDeleteFolder(folder)}
              title="Delete folder"
            >
              ×
            </button>
          </div>
        ))}

        <form className="folder-form" onSubmit={handleCreateFolder}>
          <input
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            placeholder="New folder"
            maxLength={40}
          />
          <button type="submit">Add</button>
        </form>
      </section>

      <input
        className="search-input"
        value={searchTerm}
        onChange={(event) => onSearchTermChange(event.target.value)}
        placeholder="Search notes"
      />

      <div className="note-list">
        {notes.length === 0 ? (
          <div className="empty-state">
            <strong>아직 메모가 없어요.</strong>
            <span>+ 버튼으로 첫 메모를 만들어보세요.</span>
          </div>
        ) : (
          notes.map((note) => (
            <article
              key={note.id}
              className={`note-row ${selectedNoteId === note.id ? 'selected' : ''}`}
              onClick={() => onSelectNote(note)}
            >
              <div className="note-row-main">
                <div className="note-row-title">
                  {note.is_pinned && <span className="pin-badge">Pinned</span>}
                  <strong>{note.title || 'Untitled'}</strong>
                </div>
                <p>{note.content || 'No content yet'}</p>
                <span>{formatDate(note.updated_at)}</span>
              </div>
              <div className="note-row-actions" onClick={(event) => event.stopPropagation()}>
                <button type="button" onClick={() => onTogglePin(note)}>
                  {note.is_pinned ? 'Unpin' : 'Pin'}
                </button>
                <button type="button" className="danger" onClick={() => onDeleteNote(note)}>
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}
