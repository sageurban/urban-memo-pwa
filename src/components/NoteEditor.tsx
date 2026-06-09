import { useEffect, useMemo, useState } from 'react';
import { Note, SaveStatus } from '../types/note';

type NoteEditorProps = {
  note: Note | null;
  saveStatus: SaveStatus;
  onUpdateNote: (noteId: string, values: Pick<Note, 'title' | 'content'>) => void;
};

function statusText(status: SaveStatus) {
  switch (status) {
    case 'saving':
      return 'Saving...';
    case 'saved':
      return 'Saved';
    case 'error':
      return 'Save failed';
    default:
      return 'Ready';
  }
}

export default function NoteEditor({ note, saveStatus, onUpdateNote }: NoteEditorProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    setTitle(note?.title ?? '');
    setContent(note?.content ?? '');
  }, [note?.id]);

  useEffect(() => {
    if (!note) return;
    if (title === note.title && content === note.content) return;

    const timer = window.setTimeout(() => {
      onUpdateNote(note.id, { title, content });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [title, content, note, onUpdateNote]);

  const wordCount = useMemo(() => {
    return content.trim() ? content.trim().split(/\s+/).length : 0;
  }, [content]);

  if (!note) {
    return (
      <section className="editor empty-editor">
        <h2>메모를 선택하거나 새로 만들어주세요.</h2>
        <p>Mac에서는 왼쪽 리스트, iPhone에서는 상단 리스트에서 메모를 선택하면 됩니다.</p>
      </section>
    );
  }

  return (
    <section className="editor">
      <div className="editor-toolbar">
        <span className={`save-status ${saveStatus}`}>{statusText(saveStatus)}</span>
        <span>{wordCount} words</span>
      </div>

      <input
        className="title-input"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Title"
      />

      <textarea
        className="content-input"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Start writing..."
      />
    </section>
  );
}
