import { Note } from '../types/note';

type NoteListProps = {
  notes: Note[];
  selectedNoteId: string | null;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
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
  selectedNoteId,
  searchTerm,
  onSearchTermChange,
  onSelectNote,
  onCreateNote,
  onTogglePin,
  onDeleteNote
}: NoteListProps) {
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
