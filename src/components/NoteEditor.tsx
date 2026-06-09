import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AudioFile, AudioMarker, Folder, Note, SaveStatus } from '../types/note';
import { GENRE_PRESETS, KEY_PRESETS, MOOD_PRESETS, SECTION_PRESETS, getNoteTypeOption, MusicMetadata, splitTags } from '../lib/musicTemplates';

type MarkerDraft = {
  audio_file_id: string;
  time_seconds: string;
  end_seconds: string;
  section_name: string;
  marker_type: string;
  title: string;
  description: string;
  chord_progression: string;
  bar_count: string;
  energy: string;
  reusable_idea: string;
  caution: string;
  variation_idea: string;
};

type NoteEditorProps = {
  note: Note | null;
  folders: Folder[];
  audioFiles: AudioFile[];
  audioMarkers: AudioMarker[];
  saveStatus: SaveStatus;
  audioUploadStatus: string;
  onUpdateNote: (noteId: string, values: Pick<Note, 'title' | 'content'>) => void;
  onUpdateNoteMeta: (noteId: string, metadata: MusicMetadata) => void;
  onChangeNoteFolder: (noteId: string, folderId: string | null) => void;
  onUploadAudio: (note: Note, file: File) => void;
  onDeleteAudio: (audioFile: AudioFile) => void;
  onCreateAudioMarker: (values: {
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
  }) => void;
  onUpdateAudioMarker: (markerId: string, values: Partial<Pick<AudioMarker, 'audio_file_id' | 'time_seconds' | 'end_seconds' | 'section_name' | 'marker_type' | 'title' | 'description' | 'chord_progression' | 'bar_count' | 'energy' | 'reusable_idea' | 'caution' | 'variation_idea'>>) => void;
  onDeleteAudioMarker: (marker: AudioMarker) => void;
  onTogglePin: (note: Note) => void;
  onDeleteNote: (note: Note) => void;
  onBackToList?: () => void;
};

type FolderOption = Folder & { depth: number };

const TEXT_COLOR_PRESETS = ['#f4f0e8', '#ff5a5a', '#ffca45', '#6ccd57', '#5891ff'];
const MARKER_TYPES = ['Song Form', 'Chord', 'Rhythm', 'Arrangement', 'Sound Design', 'Mix', 'Vocal', 'Lyric Hook', 'Reusable Idea'];
const FONT_SIZE_OPTIONS = [
  { label: '가', value: '2', title: 'Small' },
  { label: '가', value: '3', title: 'Normal' },
  { label: '가', value: '5', title: 'Large' }
] as const;

const EMPTY_MARKER_DRAFT: MarkerDraft = {
  audio_file_id: '',
  time_seconds: '0',
  end_seconds: '',
  section_name: 'Intro',
  marker_type: 'Song Form',
  title: '',
  description: '',
  chord_progression: '',
  bar_count: '',
  energy: '',
  reusable_idea: '',
  caution: '',
  variation_idea: ''
};

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

function formatTime(value: number | string) {
  const total = Math.max(0, Math.floor(Number(value) || 0));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function markerDraftFromMarker(marker: AudioMarker): MarkerDraft {
  return {
    audio_file_id: marker.audio_file_id ?? '',
    time_seconds: String(Math.round(Number(marker.time_seconds) || 0)),
    end_seconds: marker.end_seconds == null ? '' : String(Math.round(Number(marker.end_seconds) || 0)),
    section_name: marker.section_name ?? '',
    marker_type: marker.marker_type ?? 'Song Form',
    title: marker.title ?? '',
    description: marker.description ?? '',
    chord_progression: marker.chord_progression ?? '',
    bar_count: marker.bar_count == null ? '' : String(marker.bar_count),
    energy: marker.energy == null ? '' : String(marker.energy),
    reusable_idea: marker.reusable_idea ?? '',
    caution: marker.caution ?? '',
    variation_idea: marker.variation_idea ?? ''
  };
}

function markerPayloadFromDraft(noteId: string, draft: MarkerDraft) {
  const barCount = Number(draft.bar_count);
  const energy = Number(draft.energy);
  const endSeconds = Number(draft.end_seconds);
  return {
    note_id: noteId,
    audio_file_id: draft.audio_file_id || null,
    time_seconds: Math.max(0, Number(draft.time_seconds) || 0),
    end_seconds: draft.end_seconds === '' || !Number.isFinite(endSeconds) ? null : Math.max(0, endSeconds),
    section_name: draft.section_name.trim(),
    marker_type: draft.marker_type.trim() || 'Song Form',
    title: draft.title.trim(),
    description: draft.description.trim(),
    chord_progression: draft.chord_progression.trim(),
    bar_count: draft.bar_count === '' || !Number.isFinite(barCount) ? null : barCount,
    energy: draft.energy === '' || !Number.isFinite(energy) ? null : Math.max(0, Math.min(100, energy)),
    reusable_idea: draft.reusable_idea.trim(),
    caution: draft.caution.trim(),
    variation_idea: draft.variation_idea.trim()
  };
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
  audioMarkers,
  saveStatus,
  audioUploadStatus,
  onUpdateNote,
  onUpdateNoteMeta,
  onChangeNoteFolder,
  onUploadAudio,
  onDeleteAudio,
  onCreateAudioMarker,
  onUpdateAudioMarker,
  onDeleteAudioMarker,
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
  const [markerDraft, setMarkerDraft] = useState<MarkerDraft>(EMPTY_MARKER_DRAFT);
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const [editingMarkerDraft, setEditingMarkerDraft] = useState<MarkerDraft>(EMPTY_MARKER_DRAFT);
  const [markerTypeFilter, setMarkerTypeFilter] = useState('All');
  const [loopMarkerId, setLoopMarkerId] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState({ metadata: false, audio: false, timeline: false });
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  useEffect(() => {
    setTitle(note?.title ?? '');
    const nextContent = normalizeContentForEditor(note?.content ?? '');
    setContent(nextContent);
    if (editorRef.current) editorRef.current.innerHTML = nextContent;
    setTextColor(TEXT_COLOR_PRESETS[0]);
    setFontSize('3');
    setMetadata(note?.metadata ?? {});
    setEditingMarkerId(null);
    setMarkerTypeFilter('All');
    setLoopMarkerId(null);
    setOpenSections({ metadata: false, audio: false, timeline: false });
  }, [note?.id]);

  useEffect(() => {
    setMarkerDraft((prev) => ({
      ...prev,
      audio_file_id: prev.audio_file_id || audioFiles[0]?.id || ''
    }));
  }, [audioFiles]);

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

  const characterCount = useMemo(() => getTextFromHtml(content).trim().length, [content]);
  const folderOptions = useMemo(() => buildFolderOptions(folders), [folders]);
  const currentFolder = folderOptions.find((folder) => folder.id === note?.folder_id) ?? null;
  const sortedMarkers = useMemo(
    () => [...audioMarkers].sort((a, b) => Number(a.time_seconds) - Number(b.time_seconds)),
    [audioMarkers]
  );

  const visibleMarkers = useMemo(
    () => markerTypeFilter === 'All' ? sortedMarkers : sortedMarkers.filter((marker) => marker.marker_type === markerTypeFilter),
    [sortedMarkers, markerTypeFilter]
  );

  const timelineDuration = useMemo(() => {
    const audioDuration = Math.max(0, ...Object.values(audioDurations).filter(Number.isFinite));
    const markerDuration = Math.max(0, ...sortedMarkers.map((marker) => Number(marker.end_seconds ?? marker.time_seconds) || 0));
    return Math.max(audioDuration, markerDuration, 1);
  }, [audioDurations, sortedMarkers]);

  const markerFilterOptions = useMemo(() => ['All', ...MARKER_TYPES.filter((type) => sortedMarkers.some((marker) => marker.marker_type === type))], [sortedMarkers]);

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

  function captureCurrentTime() {
    const audioId = markerDraft.audio_file_id || audioFiles[0]?.id || '';
    const audioElement = audioId ? audioRefs.current[audioId] : null;
    const nextTime = audioElement ? Math.floor(audioElement.currentTime) : 0;
    setMarkerDraft((prev) => ({ ...prev, audio_file_id: audioId, time_seconds: String(nextTime) }));
  }

  function seekToMarker(marker: AudioMarker) {
    const audioId = marker.audio_file_id || audioFiles[0]?.id;
    if (!audioId) return;
    const audioElement = audioRefs.current[audioId];
    if (!audioElement) return;
    audioElement.currentTime = Number(marker.time_seconds) || 0;
    audioElement.play().catch(() => undefined);
  }

  function handleAudioLoaded(fileId: string, audioElement: HTMLAudioElement | null) {
    if (!audioElement) return;
    const duration = Number.isFinite(audioElement.duration) ? audioElement.duration : 0;
    setAudioDurations((prev) => ({ ...prev, [fileId]: duration }));
  }

  function handleAudioTimeUpdate(fileId: string, audioElement: HTMLAudioElement | null) {
    if (!audioElement || !loopMarkerId) return;
    const marker = sortedMarkers.find((item) => item.id === loopMarkerId);
    if (!marker) return;
    const markerAudioId = marker.audio_file_id || audioFiles[0]?.id;
    if (markerAudioId !== fileId) return;
    const start = Number(marker.time_seconds) || 0;
    const end = Number(marker.end_seconds);
    if (!Number.isFinite(end) || end <= start) return;
    if (audioElement.currentTime >= end) {
      audioElement.currentTime = start;
      audioElement.play().catch(() => undefined);
    }
  }

  function toggleMarkerLoop(marker: AudioMarker) {
    const start = Number(marker.time_seconds) || 0;
    const end = Number(marker.end_seconds);
    if (!Number.isFinite(end) || end <= start) return;
    setLoopMarkerId((current) => current === marker.id ? null : marker.id);
    seekToMarker(marker);
  }

  function submitMarker() {
    if (!note) return;
    onCreateAudioMarker(markerPayloadFromDraft(note.id, markerDraft));
    setMarkerDraft({
      ...EMPTY_MARKER_DRAFT,
      audio_file_id: markerDraft.audio_file_id || audioFiles[0]?.id || '',
      time_seconds: markerDraft.time_seconds,
      end_seconds: ''
    });
  }

  function startEditMarker(marker: AudioMarker) {
    setEditingMarkerId(marker.id);
    setEditingMarkerDraft(markerDraftFromMarker(marker));
  }

  function saveEditMarker(marker: AudioMarker) {
    const payload = markerPayloadFromDraft(marker.note_id, editingMarkerDraft);
    onUpdateAudioMarker(marker.id, {
      audio_file_id: payload.audio_file_id,
      time_seconds: payload.time_seconds,
      end_seconds: payload.end_seconds,
      section_name: payload.section_name,
      marker_type: payload.marker_type,
      title: payload.title,
      description: payload.description,
      chord_progression: payload.chord_progression,
      bar_count: payload.bar_count,
      energy: payload.energy,
      reusable_idea: payload.reusable_idea,
      caution: payload.caution,
      variation_idea: payload.variation_idea
    });
    setEditingMarkerId(null);
  }


  function toggleEditorSection(section: 'metadata' | 'audio' | 'timeline') {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }));
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
            <button type="button" className={`mobile-nav-button ${showNoteMenu ? 'active' : ''}`} onClick={() => setShowNoteMenu((current) => !current)} title="메모 메뉴">⋮</button>
          </div>
        </div>

        {showNoteMenu && (
          <div className="editor-card note-more-menu">
            <button type="button" onClick={() => { onTogglePin(note); setShowNoteMenu(false); }}>{note.is_pinned ? '고정 해제' : '메모 고정'}</button>
            <button type="button" onClick={handleMenuUploadMp3}>MP3 파일 추가</button>
            <button type="button" onClick={handleDone}>저장 후 목록으로</button>
            <button type="button" className="danger" onClick={handleMenuDeleteNote}>메모 삭제</button>
          </div>
        )}

        <div className="editor-card title-card">
          <input className="title-input title-input-redesign" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="제목을 입력하세요" maxLength={100} />
          <span className="title-count">{title.length}/100</span>
        </div>

        <div className="editor-card folder-card">
          <div className="folder-card-left"><span className="folder-card-icon">⌂</span><span>폴더</span></div>
          <label className="folder-select-pill">
            <span className="folder-select-dot" style={{ background: currentFolder?.color || '#ff5a5a' }} />
            <select value={note.folder_id ?? ''} onChange={(event) => onChangeNoteFolder(note.id, event.target.value || null)}>
              <option value="">Unfiled</option>
              {folderOptions.map((folder) => <option key={folder.id} value={folder.id}>{`${'— '.repeat(folder.depth)}${folder.name}`}</option>)}
            </select>
          </label>
        </div>

        <div className={`editor-card music-meta-card collapsible-editor-card ${openSections.metadata ? 'open' : 'collapsed'}`}>
          <button type="button" className="collapsible-card-title" onClick={() => toggleEditorSection('metadata')}>
            <strong>Metadata</strong><span>Genre · BPM · Key · Tags</span><b>{openSections.metadata ? '▴' : '▾'}</b>
          </button>
          <div className="collapsible-card-body">
          <div className="music-meta-header">
            <span className="note-type-large-badge" style={{ borderColor: getNoteTypeOption(note.note_type).color, color: getNoteTypeOption(note.note_type).color }}>{getNoteTypeOption(note.note_type).label}</span>
            <small>검색/필터에 쓰이는 음악 분석 데이터</small>
          </div>
          <div className="music-meta-grid">
            <datalist id="note-editor-genre-presets">{GENRE_PRESETS.map((item) => <option key={item} value={item} />)}</datalist>
            <datalist id="note-editor-key-presets">{KEY_PRESETS.map((item) => <option key={item} value={item} />)}</datalist>
            <datalist id="note-editor-mood-presets">{MOOD_PRESETS.map((item) => <option key={item} value={item} />)}</datalist>
            <datalist id="note-editor-section-presets">{SECTION_PRESETS.map((item) => <option key={item} value={item} />)}</datalist>
            <label>Genre<input list="note-editor-genre-presets" value={metadata.genre ?? ''} onChange={(event) => updateMetaField('genre', event.target.value)} placeholder="K-pop / R&B" /></label>
            <label>BPM<input value={metadata.bpm ?? ''} onChange={(event) => updateMetaField('bpm', event.target.value)} placeholder="134" inputMode="numeric" /></label>
            <label>Key<input list="note-editor-key-presets" value={metadata.key ?? ''} onChange={(event) => updateMetaField('key', event.target.value)} placeholder="B Major" /></label>
            <label>Mood<input list="note-editor-mood-presets" value={metadata.mood ?? ''} onChange={(event) => updateMetaField('mood', event.target.value)} placeholder="청량 / nostalgic" /></label>
            <label>Section<input list="note-editor-section-presets" value={metadata.section ?? ''} onChange={(event) => updateMetaField('section', event.target.value)} placeholder="Chorus" /></label>
            <label>Harmony<input value={metadata.harmony ?? ''} onChange={(event) => updateMetaField('harmony', event.target.value)} placeholder="Modal Interchange" /></label>
            <label>Instrument<input value={metadata.instrument ?? ''} onChange={(event) => updateMetaField('instrument', event.target.value)} placeholder="EP Pluck" /></label>
            <label>Confidence<select value={metadata.confidence ?? ''} onChange={(event) => updateMetaField('confidence', event.target.value)}><option value="">None</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></label>
            <div className="meta-wide tag-editor-block">
              <span>Tags</span>
              <div className="tag-chip-editor">
                {splitTags(metadata.tags).map((tag) => <button type="button" key={tag} onClick={() => removeTag(tag)}>#{tag.replace(/^#/, '')} ×</button>)}
                <input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addTag(); } }} onBlur={() => addTag()} placeholder="태그 입력 후 Enter" />
              </div>
            </div>
            <label className="meta-wide">Source<input value={metadata.source ?? ''} onChange={(event) => updateMetaField('source', event.target.value)} placeholder="직접 분석 / 공식 자료 / 추정" /></label>
          </div>
          </div>
        </div>

        <div className="text-section-focus-header"><strong>Text Editor</strong><span>본문 작성 영역은 항상 열려 있습니다.</span></div>
        <div className="editor-card controls-card">
          <div className="controls-grid">
            <div className="control-block"><span className="control-label">텍스트 크기</span><div className="size-chip-row">{FONT_SIZE_OPTIONS.map((option) => <button key={option.value} type="button" className={`size-chip size-${option.value} ${fontSize === option.value ? 'active' : ''}`} onMouseDown={(event) => event.preventDefault()} onClick={() => applyFontSize(option.value)} title={option.title}>{option.label}</button>)}</div></div>
            <div className="control-block"><span className="control-label">텍스트 색상</span><div className="color-swatch-row">{TEXT_COLOR_PRESETS.map((color) => <button key={color} type="button" className={`color-swatch ${textColor === color ? 'active' : ''}`} style={{ background: color }} onMouseDown={(event) => event.preventDefault()} onClick={() => applyColor(color)} aria-label={`텍스트 색상 ${color}`}>{textColor === color ? '✓' : ''}</button>)}<label className="color-swatch custom-color-button" aria-label="사용자 지정 색상">+<input type="color" value={textColor} onChange={(event) => applyColor(event.target.value)} /></label></div></div>
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
          <div ref={editorRef} className="content-editor content-editor-redesign" contentEditable role="textbox" aria-label="Note content" data-placeholder="메모를 입력하세요..." onInput={syncEditorContent} onBlur={syncEditorContent} suppressContentEditableWarning />
          <span className="content-count">{characterCount.toLocaleString()}자 · 무제한</span>
        </div>

        <section className={`editor-card audio-panel audio-panel-redesign collapsible-editor-card ${openSections.audio ? 'open' : 'collapsed'}`}>
          <button type="button" className="collapsible-card-title" onClick={() => toggleEditorSection('audio')}>
            <strong>MP3 Files</strong><span>{audioFiles.length} attached</span><b>{openSections.audio ? '▴' : '▾'}</b>
          </button>
          <div className="collapsible-card-body">
          <div className="audio-panel-header audio-panel-header-redesign">
            <div><strong>MP3 파일</strong><span>전체 {audioFiles.length}개</span></div>
            <button type="button" className="upload-mp3-inline" onClick={() => fileInputRef.current?.click()}>＋ MP3 파일 추가</button>
            <input ref={fileInputRef} type="file" accept="audio/mpeg,audio/mp3,.mp3" onChange={handleFileChange} hidden />
          </div>

          {audioUploadStatus && <p className="audio-status">{audioUploadStatus}</p>}

          {audioFiles.length === 0 ? (
            <div className="audio-empty">이 메모에 저장된 MP3가 아직 없습니다. 타임라인 분석을 시작하려면 먼저 MP3를 업로드하세요.</div>
          ) : (
            <div className="audio-list audio-list-redesign">
              {audioFiles.map((file) => (
                <article className="audio-row audio-row-redesign" key={file.id}>
                  <div className="audio-file-icon">♫</div>
                  <div className="audio-info"><strong>{file.file_name}</strong><span>{[formatBytes(file.file_size), formatDate(file.created_at)].filter(Boolean).join(' • ')}</span></div>
                  <div className="audio-row-actions">
                    {file.signed_url ? (
                      <audio
                        ref={(el) => { audioRefs.current[file.id] = el; }}
                        controls
                        src={file.signed_url}
                        onLoadedMetadata={(event) => handleAudioLoaded(file.id, event.currentTarget)}
                        onTimeUpdate={(event) => handleAudioTimeUpdate(file.id, event.currentTarget)}
                      />
                    ) : <span className="muted">Audio URL loading...</span>}
                    <button type="button" className="ghost-button danger" onClick={() => onDeleteAudio(file)}>삭제</button>
                  </div>
                </article>
              ))}
            </div>
          )}
          </div>
        </section>

        <section className={`editor-card timeline-panel collapsible-editor-card ${openSections.timeline ? 'open' : 'collapsed'}`}>
          <button type="button" className="collapsible-card-title" onClick={() => toggleEditorSection('timeline')}>
            <strong>Audio Timeline</strong><span>{sortedMarkers.length} markers</span><b>{openSections.timeline ? '▴' : '▾'}</b>
          </button>
          <div className="collapsible-card-body">
          <div className="timeline-header">
            <div><strong>Audio Timeline Analysis v2</strong><span>송폼 타임라인, 에너지, A-B Loop, 재사용 아이디어까지 한 번에 관리합니다.</span></div>
            <span className="timeline-count">{sortedMarkers.length} markers</span>
          </div>

          {sortedMarkers.length > 0 && (
            <div className="timeline-visual-card">
              <div className="timeline-track" aria-label="Song form timeline">
                {visibleMarkers.map((marker) => {
                  const start = Number(marker.time_seconds) || 0;
                  const end = Number(marker.end_seconds ?? marker.time_seconds) || start;
                  const left = Math.min(96, Math.max(0, (start / timelineDuration) * 100));
                  const width = Math.max(3, ((Math.max(end, start + 2) - start) / timelineDuration) * 100);
                  return (
                    <button
                      type="button"
                      key={marker.id}
                      className={`timeline-segment ${loopMarkerId === marker.id ? 'looping' : ''}`}
                      style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
                      onClick={() => seekToMarker(marker)}
                      title={`${formatTime(marker.time_seconds)} ${marker.section_name || marker.marker_type}`}
                    >
                      <strong>{marker.section_name || marker.marker_type}</strong>
                      <span>{formatTime(marker.time_seconds)}</span>
                    </button>
                  );
                })}
              </div>

              <div className="energy-graph">
                {sortedMarkers.filter((marker) => marker.energy != null).map((marker) => (
                  <button type="button" key={marker.id} onClick={() => seekToMarker(marker)}>
                    <span>{marker.section_name || marker.marker_type}</span>
                    <i><b style={{ width: `${Math.max(0, Math.min(100, Number(marker.energy) || 0))}%` }} /></i>
                    <em>{marker.energy}</em>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="marker-filter-bar">
            {markerFilterOptions.map((type) => (
              <button
                type="button"
                key={type}
                className={markerTypeFilter === type ? 'active' : ''}
                onClick={() => setMarkerTypeFilter(type)}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="marker-create-card">
            <div className="marker-create-top">
              <label>MP3<select value={markerDraft.audio_file_id} onChange={(event) => setMarkerDraft((prev) => ({ ...prev, audio_file_id: event.target.value }))}><option value="">No audio selected</option>{audioFiles.map((file) => <option key={file.id} value={file.id}>{file.file_name}</option>)}</select></label>
              <label>Start<input type="number" min="0" value={markerDraft.time_seconds} onChange={(event) => setMarkerDraft((prev) => ({ ...prev, time_seconds: event.target.value }))} /></label>
              <label>End<input type="number" min="0" value={markerDraft.end_seconds} onChange={(event) => setMarkerDraft((prev) => ({ ...prev, end_seconds: event.target.value }))} placeholder="Loop end" /></label>
              <button type="button" onClick={captureCurrentTime} disabled={audioFiles.length === 0}>현재 위치 가져오기</button>
            </div>
            <div className="marker-grid">
              <label>Section<input value={markerDraft.section_name} onChange={(event) => setMarkerDraft((prev) => ({ ...prev, section_name: event.target.value }))} placeholder="Chorus" /></label>
              <label>Type<select value={markerDraft.marker_type} onChange={(event) => setMarkerDraft((prev) => ({ ...prev, marker_type: event.target.value }))}>{MARKER_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
              <label>Bars<input type="number" min="0" value={markerDraft.bar_count} onChange={(event) => setMarkerDraft((prev) => ({ ...prev, bar_count: event.target.value }))} placeholder="8" /></label>
              <label>Energy<input type="number" min="0" max="100" value={markerDraft.energy} onChange={(event) => setMarkerDraft((prev) => ({ ...prev, energy: event.target.value }))} placeholder="90" /></label>
              <label className="marker-wide">Title<input value={markerDraft.title} onChange={(event) => setMarkerDraft((prev) => ({ ...prev, title: event.target.value }))} placeholder="Chorus drop" /></label>
              <label className="marker-wide">Chord<input value={markerDraft.chord_progression} onChange={(event) => setMarkerDraft((prev) => ({ ...prev, chord_progression: event.target.value }))} placeholder="Bmaj9 - F#/A# - G#m7 - Emaj9" /></label>
              <label className="marker-wide">Description<textarea value={markerDraft.description} onChange={(event) => setMarkerDraft((prev) => ({ ...prev, description: event.target.value }))} placeholder="Full drum groove, bright synth hook, vocal stack enters." /></label>
              <label className="marker-wide">Reusable Idea<textarea value={markerDraft.reusable_idea} onChange={(event) => setMarkerDraft((prev) => ({ ...prev, reusable_idea: event.target.value }))} placeholder="내 곡에 가져올 수 있는 요소" /></label>
              <label className="marker-wide">Caution<textarea value={markerDraft.caution} onChange={(event) => setMarkerDraft((prev) => ({ ...prev, caution: event.target.value }))} placeholder="그대로 쓰면 위험한 요소" /></label>
              <label className="marker-wide">Variation<textarea value={markerDraft.variation_idea} onChange={(event) => setMarkerDraft((prev) => ({ ...prev, variation_idea: event.target.value }))} placeholder="변형 아이디어" /></label>
            </div>
            <button type="button" className="add-marker-button" onClick={submitMarker} disabled={!note}>＋ 현재 위치에 마커 추가</button>
          </div>

          <div className="marker-list">
            {visibleMarkers.length === 0 ? (
              <div className="audio-empty">아직 타임라인 마커가 없습니다. MP3를 재생하고 현재 위치를 가져와 첫 마커를 추가하세요.</div>
            ) : (
              visibleMarkers.map((marker) => {
                const isEditing = editingMarkerId === marker.id;
                return (
                  <article className="marker-row" key={marker.id}>
                    <button type="button" className="marker-time" onClick={() => seekToMarker(marker)}>{formatTime(marker.time_seconds)}</button>
                    {isEditing ? (
                      <div className="marker-edit-panel">
                        <div className="marker-grid">
                          <label>Start<input type="number" min="0" value={editingMarkerDraft.time_seconds} onChange={(event) => setEditingMarkerDraft((prev) => ({ ...prev, time_seconds: event.target.value }))} /></label>
                          <label>End<input type="number" min="0" value={editingMarkerDraft.end_seconds} onChange={(event) => setEditingMarkerDraft((prev) => ({ ...prev, end_seconds: event.target.value }))} /></label>
                          <label>Section<input value={editingMarkerDraft.section_name} onChange={(event) => setEditingMarkerDraft((prev) => ({ ...prev, section_name: event.target.value }))} /></label>
                          <label>Type<select value={editingMarkerDraft.marker_type} onChange={(event) => setEditingMarkerDraft((prev) => ({ ...prev, marker_type: event.target.value }))}>{MARKER_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
                          <label>Energy<input type="number" min="0" max="100" value={editingMarkerDraft.energy} onChange={(event) => setEditingMarkerDraft((prev) => ({ ...prev, energy: event.target.value }))} /></label>
                          <label className="marker-wide">Title<input value={editingMarkerDraft.title} onChange={(event) => setEditingMarkerDraft((prev) => ({ ...prev, title: event.target.value }))} /></label>
                          <label className="marker-wide">Chord<input value={editingMarkerDraft.chord_progression} onChange={(event) => setEditingMarkerDraft((prev) => ({ ...prev, chord_progression: event.target.value }))} /></label>
                          <label className="marker-wide">Description<textarea value={editingMarkerDraft.description} onChange={(event) => setEditingMarkerDraft((prev) => ({ ...prev, description: event.target.value }))} /></label>
                          <label className="marker-wide">Reusable Idea<textarea value={editingMarkerDraft.reusable_idea} onChange={(event) => setEditingMarkerDraft((prev) => ({ ...prev, reusable_idea: event.target.value }))} /></label>
                          <label className="marker-wide">Caution<textarea value={editingMarkerDraft.caution} onChange={(event) => setEditingMarkerDraft((prev) => ({ ...prev, caution: event.target.value }))} /></label>
                          <label className="marker-wide">Variation<textarea value={editingMarkerDraft.variation_idea} onChange={(event) => setEditingMarkerDraft((prev) => ({ ...prev, variation_idea: event.target.value }))} /></label>
                        </div>
                        <div className="marker-actions"><button type="button" onClick={() => saveEditMarker(marker)}>Save</button><button type="button" className="ghost-button" onClick={() => setEditingMarkerId(null)}>Cancel</button></div>
                      </div>
                    ) : (
                      <>
                        <div className="marker-main">
                          <div className="marker-title-line"><strong>{marker.title || marker.section_name || marker.marker_type}</strong><span>{marker.marker_type}</span></div>
                          <p>{marker.description || 'No description yet'}</p>
                          <div className="marker-meta-line">
                            {marker.section_name && <span>{marker.section_name}</span>}
                            {marker.end_seconds != null && <span>{formatTime(marker.time_seconds)}~{formatTime(marker.end_seconds)}</span>}
                            {marker.bar_count != null && <span>{marker.bar_count} bars</span>}
                            {marker.energy != null && <span>Energy {marker.energy}</span>}
                            {marker.chord_progression && <span>{marker.chord_progression}</span>}
                          </div>
                          {(marker.reusable_idea || marker.caution || marker.variation_idea) && (
                            <div className="marker-idea-box">
                              {marker.reusable_idea && <p><strong>Reusable</strong>{marker.reusable_idea}</p>}
                              {marker.caution && <p><strong>Caution</strong>{marker.caution}</p>}
                              {marker.variation_idea && <p><strong>Variation</strong>{marker.variation_idea}</p>}
                            </div>
                          )}
                        </div>
                        <div className="marker-actions">
                          {marker.end_seconds != null && Number(marker.end_seconds) > Number(marker.time_seconds) && <button type="button" className={loopMarkerId === marker.id ? 'active-loop' : ''} onClick={() => toggleMarkerLoop(marker)}>{loopMarkerId === marker.id ? 'Loop On' : 'A-B Loop'}</button>}
                          <button type="button" onClick={() => startEditMarker(marker)}>Edit</button>
                          <button type="button" className="danger ghost-button" onClick={() => onDeleteAudioMarker(marker)}>Delete</button>
                        </div>
                      </>
                    )}
                  </article>
                );
              })
            )}
          </div>
          </div>
        </section>
      </div>
    </section>
  );
}
