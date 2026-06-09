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

type FolderOption = Folder & { depth: number };

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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeContentForEditor(content: string) {
  if (!content) return '';
  if (/<[a-z][\s\S]*>/i.test(content)) return content;
  return escapeHtml(content).replace(/\n/g, '<br>');
}

function getTextFromHtml(html: string) {
  const element = document.createElement('div');
  element.innerHTML = html;
  return element.textContent ?? '';
}

function buildFolderOptions(folders: Folder[]): FolderOption[] {
  const byParent = new Map<string | null, Folder[]>();

  folders.forEach((folder) => {
    const key = folder.parent_id ?? null;
    const list = byParent.get(key) ?? [];
    list.push(folder);
    byParent.set(key, list);
  });

  byParent.forEach((list) => {
    list.sort((a, b) => a.name.localeCompare(b.name));
  });

  const result: FolderOption[] = [];

  function visit(parentId: string | null, depth: number) {
    const children = byParent.get(parentId) ?? [];
    children.forEach((folder) => {
      result.push({ ...folder, depth });
      visit(folder.id, depth + 1);
    });
  }

  visit(null, 0);
  return result;
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
  const [textColor, setTextColor] = useState('#f5f5f5');
  const [fontSize, setFontSize] = useState('3');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setTitle(note?.title ?? '');
    const nextContent = normalizeContentForEditor(note?.content ?? '');
    setContent(nextContent);
    if (editorRef.current) editorRef.current.innerHTML = nextContent;
  }, [note?.id]);

  useEffect(() => {
    if (!note) return;
    if (title === note.title && content === normalizeContentForEditor(note.content)) return;

    const timer = window.setTimeout(() => {
      onUpdateNote(note.id, { title, content });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [title, content, note, onUpdateNote]);

  const wordCount = useMemo(() => {
    const text = getTextFromHtml(content).trim();
    return text ? text.split(/\s+/).length : 0;
  }, [content]);

  const folderOptions = useMemo(() => buildFolderOptions(folders), [folders]);

  function syncEditorContent() {
    setContent(editorRef.current?.innerHTML ?? '');
  }

  function applyCommand(command: 'foreColor' | 'fontSize', value: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncEditorContent();
  }

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
    <section className="editor rich-editor-layout">
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
            {folderOptions.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {`${'— '.repeat(folder.depth)}${folder.name}`}
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

      <div className="format-toolbar" aria-label="Text formatting tools">
        <label>
          Text color
          <input
            type="color"
            value={textColor}
            onChange={(event) => {
              setTextColor(event.target.value);
              applyCommand('foreColor', event.target.value);
            }}
          />
        </label>

        <label>
          Text size
          <select
            value={fontSize}
            onChange={(event) => {
              setFontSize(event.target.value);
              applyCommand('fontSize', event.target.value);
            }}
          >
            <option value="2">Small</option>
            <option value="3">Normal</option>
            <option value="5">Large</option>
            <option value="7">Huge</option>
          </select>
        </label>

        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('fontSize', '3')}>
          Normal
        </button>
      </div>

      <div
        ref={editorRef}
        className="content-editor"
        contentEditable
        role="textbox"
        aria-label="Note content"
        data-placeholder="Start writing..."
        onInput={syncEditorContent}
        onBlur={syncEditorContent}
        suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: content }}
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
