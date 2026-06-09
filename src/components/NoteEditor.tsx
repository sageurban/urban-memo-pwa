import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AudioFile, Folder, Note, SaveStatus } from '../types/note';
import { getNoteTypeOption, MusicMetadata, splitTags } from '../lib/musicTemplates';

type NoteEditorProps = {
  note: Note | null;
  folders: Folder[];
  audioFiles: AudioFile[];
  saveStatus: SaveStatus;
  audioUploadStatus: string;
  onUpdateNote: (noteId: string, values: Pick<Note, 'title' | 'content'>) => void;
  onUpdateNoteMeta: (noteId: string, metadata: MusicMetadata) => void;
  onChangeNoteFolder: (noteId: string, folderId: string | null) => void;
  onUploadAudio: (note: Note, file: File) => void;
  onDeleteAudio: (audioFile: AudioFile) => void;
  onTogglePin: (note: Note) => void;
  onDeleteNote: (note: Note) => void;
  onBackToList?: () => void;
};

type FolderOption = Folder & { depth: number };

const TEXT_COLOR_PRESETS = ['#f4f0e8', '#ff5a5a', '#ffca45', '#6ccd57', '#5891ff'];
const FONT_SIZE_OPTIONS = [
  { label: '가', value: '2', title: 'Small' },
  { label: '가', value: '3', title: 'Normal' },
  { label: '가', value: '5', title: 'Large' }
] as const;

function statusText(status: SaveStatus) {
  switch (status) {
    case 'saving':
      return '저장 중';
    case 'saved':
      return '저장됨';
    case 'error':
      return '저장 실패';
    default:
      return '준비됨';
  }
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '';
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(mb >= 10 ? 1 : 2)}MB`;
}

function formatDate(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(value));
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
  onUpdateNoteMeta,
  onChangeNoteFolder,
  onUploadAudio,
  onDeleteAudio,
  onTogglePin,
  onDeleteNote,
  onBackToList
}: NoteEditorProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [textColor, setTextColor] = useState(TEXT_COLOR_PRESETS[0]);
  const [fontSize, setFontSize] = useState('3');
  const [metadata, setMetadata] = useState<MusicMetadata>({});
  const [tagDraft, setTagDraft] = useState('');
  const [showNoteMenu, setShowNoteMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setTitle(note?.title ?? '');
    const nextContent = normalizeContentForEditor(note?.content ?? '');
    setContent(nextContent);
    if (editorRef.current) editorRef.current.innerHTML = nextContent;
    setTextColor(TEXT_COLOR_PRESETS[0]);
    setFontSize('3');
    setMetadata(note?.metadata ?? {});
  }, [note?.id]);

  useEffect(() => {
    if (!note) return;
    if (title === note.title && content === normalizeContentForEditor(note.content)) return;

    const timer = window.setTimeout(() => {
      onUpdateNote(note.id, { title, content });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [title, content, note, onUpdateNote]);

  useEffect(() => {
    if (!note) return;
    const current = JSON.stringify(note.metadata ?? {});
    const next = JSON.stringify(metadata ?? {});
    if (current === next) return;

    const timer = window.setTimeout(() => {
      onUpdateNoteMeta(note.id, metadata);
    }, 650);

    return () => window.clearTimeout(timer);
  }, [metadata, note, onUpdateNoteMeta]);

  const characterCount = useMemo(() => {
    const text = getTextFromHtml(content).trim();
    return text.length;
  }, [content]);

  const folderOptions = useMemo(() => buildFolderOptions(folders), [folders]);
  const currentFolder = folderOptions.find((folder) => folder.id === note?.folder_id) ?? null;

  function syncEditorContent() {
    setContent(editorRef.current?.innerHTML ?? '');
  }

  function applyCommand(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncEditorContent();
  }

  function applyColor(value: string) {
    setTextColor(value);
    applyCommand('foreColor', value);
  }

  function applyFontSize(value: string) {
    setFontSize(value);
    applyCommand('fontSize', value);
  }

  function updateMetaField(field: keyof MusicMetadata, value: string) {
    setMetadata((prev) => ({ ...prev, [field]: value }));
  }


  function addTag(rawValue?: string) {
    const value = (rawValue ?? tagDraft).trim().replace(/^#/, '');
    if (!value) return;

    const currentTags = splitTags(metadata.tags);
    if (currentTags.some((tag) => tag.toLowerCase() === value.toLowerCase())) {
      setTagDraft('');
      return;
    }

    updateMetaField('tags', [...currentTags, value].join(', '));
    setTagDraft('');
  }

  function removeTag(tagToRemove: string) {
    const nextTags = splitTags(metadata.tags).filter((tag) => tag !== tagToRemove);
    updateMetaField('tags', nextTags.join(', '));
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (!note) return;
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    onUploadAudio(note, file);
  }


  function getCurrentContent() {
    return editorRef.current?.innerHTML ?? content;
  }

  function handleDone() {
    if (!note) return;
    const currentContent = getCurrentContent();
    setContent(currentContent);
    onUpdateNote(note.id, { title, content: currentContent });
    setShowNoteMenu(false);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    onBackToList?.();
  }

  function handleMenuUploadMp3() {
    setShowNoteMenu(false);
    fileInputRef.current?.click();
  }

  function handleMenuDeleteNote() {
    if (!note) return;
    setShowNoteMenu(false);
    onDeleteNote(note);
    onBackToList?.();
  }

  if (!note) {
    return (
      <section className="editor empty-editor editor-redesign-shell">
        <h2>메모를 선택하거나 새로 만들어주세요.</h2>
        <p>왼쪽 폴더/메모 리스트에서 선택하면 이 화면에서 바로 편집할 수 있습니다.</p>
      </section>
    );
  }

  return (
    <section className="editor rich-editor-layout editor-redesign-shell">
      <div className="editor-phone-frame">
        <div className="editor-mobile-topline">
          <button type="button" className="mobile-nav-button" onClick={onBackToList}>‹</button>
          <div className="editor-mobile-title">
            <strong>{getNoteTypeOption(note.note_type).label}</strong>
            <span><i>☁</i> {statusText(saveStatus)} • 방금 전</span>
          </div>
          <div className="mobile-action-group">
            <button type="button" className="mobile-nav-button" onClick={handleDone} title="작성 완료">✓</button>
            <button
              type="button"
              className={`mobile-nav-button ${showNoteMenu ? 'active' : ''}`}
              onClick={() => setShowNoteMenu((current) => !current)}
              title="메모 메뉴"
            >
              ⋮
            </button>
          </div>
        </div>

        {showNoteMenu && (
          <div className="editor-card note-more-menu">
            <button type="button" onClick={() => { onTogglePin(note); setShowNoteMenu(false); }}>
              {note.is_pinned ? '고정 해제' : '메모 고정'}
            </button>
            <button type="button" onClick={handleMenuUploadMp3}>MP3 파일 추가</button>
            <button type="button" onClick={handleDone}>저장 후 목록으로</button>
            <button type="button" className="danger" onClick={handleMenuDeleteNote}>메모 삭제</button>
          </div>
        )}

        <div className="editor-card title-card">
          <input
            className="title-input title-input-redesign"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="제목을 입력하세요"
            maxLength={100}
          />
          <span className="title-count">{title.length}/100</span>
        </div>

        <div className="editor-card folder-card">
          <div className="folder-card-left">
            <span className="folder-card-icon">⌂</span>
            <span>폴더</span>
          </div>
          <label className="folder-select-pill">
            <span className="folder-select-dot" style={{ background: currentFolder?.color || '#ff5a5a' }} />
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

        <div className="editor-card music-meta-card">
          <div className="music-meta-header">
            <span className="note-type-large-badge" style={{ borderColor: getNoteTypeOption(note.note_type).color, color: getNoteTypeOption(note.note_type).color }}>
              {getNoteTypeOption(note.note_type).label}
            </span>
            <small>검색/필터에 쓰이는 음악 분석 데이터</small>
          </div>
          <div className="music-meta-grid">
            <label>Genre<input value={metadata.genre ?? ''} onChange={(event) => updateMetaField('genre', event.target.value)} placeholder="K-pop / R&B" /></label>
            <label>BPM<input value={metadata.bpm ?? ''} onChange={(event) => updateMetaField('bpm', event.target.value)} placeholder="134" inputMode="numeric" /></label>
            <label>Key<input value={metadata.key ?? ''} onChange={(event) => updateMetaField('key', event.target.value)} placeholder="B Major" /></label>
            <label>Mood<input value={metadata.mood ?? ''} onChange={(event) => updateMetaField('mood', event.target.value)} placeholder="청량 / nostalgic" /></label>
            <label>Section<input value={metadata.section ?? ''} onChange={(event) => updateMetaField('section', event.target.value)} placeholder="Chorus" /></label>
            <label>Harmony<input value={metadata.harmony ?? ''} onChange={(event) => updateMetaField('harmony', event.target.value)} placeholder="Modal Interchange" /></label>
            <label>Instrument<input value={metadata.instrument ?? ''} onChange={(event) => updateMetaField('instrument', event.target.value)} placeholder="EP Pluck" /></label>
            <label>Confidence<select value={metadata.confidence ?? ''} onChange={(event) => updateMetaField('confidence', event.target.value)}><option value="">None</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></label>
            <div className="meta-wide tag-editor-block">
              <span>Tags</span>
              <div className="tag-chip-editor">
                {splitTags(metadata.tags).map((tag) => (
                  <button type="button" key={tag} onClick={() => removeTag(tag)}>
                    #{tag.replace(/^#/, '')} ×
                  </button>
                ))}
                <input
                  value={tagDraft}
                  onChange={(event) => setTagDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ',') {
                      event.preventDefault();
                      addTag();
                    }
                  }}
                  onBlur={() => addTag()}
                  placeholder="태그 입력 후 Enter"
                />
              </div>
            </div>
            <label className="meta-wide">Source<input value={metadata.source ?? ''} onChange={(event) => updateMetaField('source', event.target.value)} placeholder="직접 분석 / 공식 자료 / 추정" /></label>
          </div>
        </div>

        <div className="editor-card controls-card">
          <div className="controls-grid">
            <div className="control-block">
              <span className="control-label">텍스트 크기</span>
              <div className="size-chip-row">
                {FONT_SIZE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`size-chip size-${option.value} ${fontSize === option.value ? 'active' : ''}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyFontSize(option.value)}
                    title={option.title}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-block">
              <span className="control-label">텍스트 색상</span>
              <div className="color-swatch-row">
                {TEXT_COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-swatch ${textColor === color ? 'active' : ''}`}
                    style={{ background: color }}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyColor(color)}
                    aria-label={`텍스트 색상 ${color}`}
                  >
                    {textColor === color ? '✓' : ''}
                  </button>
                ))}
                <label className="color-swatch custom-color-button" aria-label="사용자 지정 색상">
                  +
                  <input
                    type="color"
                    value={textColor}
                    onChange={(event) => applyColor(event.target.value)}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="editor-card toolbar-card">
          <div className="toolbar-icon-row">
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('bold')}><strong>B</strong></button>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('italic')}><em>I</em></button>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('underline')}><u>U</u></button>
            <span className="toolbar-divider" />
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('insertUnorderedList')}>•≡</button>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('insertOrderedList')}>1≡</button>
            <span className="toolbar-divider" />
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('justifyLeft')}>≣</button>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('justifyCenter')}>≣</button>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('justifyRight')}>≣</button>
          </div>
        </div>

        <div className="editor-card content-card">
          <div
            ref={editorRef}
            className="content-editor content-editor-redesign"
            contentEditable
            role="textbox"
            aria-label="Note content"
            data-placeholder="메모를 입력하세요..."
            onInput={syncEditorContent}
            onBlur={syncEditorContent}
            suppressContentEditableWarning
          />
          <span className="content-count">{characterCount.toLocaleString()}자 · 무제한</span>
        </div>

        <section className="editor-card audio-panel audio-panel-redesign">
          <div className="audio-panel-header audio-panel-header-redesign">
            <div>
              <strong>MP3 파일</strong>
              <span>전체 {audioFiles.length}개</span>
            </div>
            <button type="button" className="upload-mp3-inline" onClick={() => fileInputRef.current?.click()}>
              ＋ MP3 파일 추가
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
            <div className="audio-list audio-list-redesign">
              {audioFiles.map((file) => (
                <article className="audio-row audio-row-redesign" key={file.id}>
                  <div className="audio-file-icon">♫</div>
                  <div className="audio-info">
                    <strong>{file.file_name}</strong>
                    <span>{[formatBytes(file.file_size), formatDate(file.created_at)].filter(Boolean).join(' • ')}</span>
                  </div>
                  <div className="audio-row-actions">
                    {file.signed_url ? (
                      <audio controls src={file.signed_url} />
                    ) : (
                      <span className="muted">Audio URL loading...</span>
                    )}
                    <button type="button" className="ghost-button danger" onClick={() => onDeleteAudio(file)}>
                      삭제
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
