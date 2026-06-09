import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AudioFile, Folder, Note, SaveStatus } from '../types/note';

type NoteEditorProps = {
  note: Note | null;
  folders: Folder[];
  audioFiles: AudioFile[];
  saveStatus: SaveStatus;
  audioUploadStatus: string;
  onUpdateNote: (noteId: string, values: Pick<Note, 'title' | 'content'>) => void;
  onChangeNoteFolder: (noteId: string, folderId: string | null) => void;
  onUploadAudio: (note: Note, file: File) => void;
  onDeleteAudio: (audioFile: AudioFile) => void;
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

function formatBytes(bytes: number | null) {
  if (!bytes) return '';
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
}

export default function NoteEditor({
  note,
  folders,
  audioFiles,
  saveStatus,
  audioUploadStatus,
  onUpdateNote,
  onChangeNoteFolder,
  onUploadAudio,
  onDeleteAudio
}: NoteEditorProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (!note) return;
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    onUploadAudio(note, file);
  }

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

      <div className="note-meta-bar">
        <label>
          Folder
          <select
            value={note.folder_id ?? ''}
            onChange={(event) => onChangeNoteFolder(note.id, event.target.value || null)}
          >
            <option value="">Unfiled</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </label>
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

      <section className="audio-panel">
        <div className="audio-panel-header">
          <div>
            <strong>MP3 Files</strong>
            <span>{audioFiles.length} attached</span>
          </div>
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            Upload MP3
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,audio/mp3,.mp3"
            onChange={handleFileChange}
            hidden
          />
        </div>

        {audioUploadStatus && <p className="audio-status">{audioUploadStatus}</p>}

        {audioFiles.length === 0 ? (
          <div className="audio-empty">이 메모에 저장된 MP3가 아직 없습니다.</div>
        ) : (
          <div className="audio-list">
            {audioFiles.map((file) => (
              <article className="audio-row" key={file.id}>
                <div className="audio-info">
                  <strong>{file.file_name}</strong>
                  <span>{formatBytes(file.file_size)}</span>
                </div>
                {file.signed_url ? (
                  <audio controls src={file.signed_url} />
                ) : (
                  <span className="muted">Audio URL loading...</span>
                )}
                <button type="button" className="danger ghost-button" onClick={() => onDeleteAudio(file)}>
                  Delete MP3
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
