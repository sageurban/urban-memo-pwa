import { CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Folder, Note } from '../types/note';
import { AdvancedFilters, BPM_PRESETS, GENRE_PRESETS, getNoteTypeOption, HARMONY_PRESETS, INSTRUMENT_PRESETS, KEY_PRESETS, MOOD_PRESETS, NOTE_TYPE_OPTIONS, NoteType, SECTION_PRESETS, splitTags } from '../lib/musicTemplates';

type FolderFilter = 'all' | 'unfiled' | string;

type RecentWorkItem = {
  id: string;
  title: string;
  note_type: NoteType;
  folderName: string;
  updated_at: string;
};

type NoteListProps = {
  notes: Note[];
  allNotes: Note[];
  folders: Folder[];
  selectedNoteId: string | null;
  selectedFolderId: FolderFilter;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSelectFolder: (folderId: FolderFilter) => void;
  onCreateFolder: (name: string, color: string, parentId: string | null) => void;
  onUpdateFolder: (folder: Folder, values: Partial<Pick<Folder, 'name' | 'color' | 'parent_id'>>) => void;
  onDeleteFolder: (folder: Folder) => void;
  onSelectNote: (note: Note) => void;
  onCreateNote: (noteTypes?: NoteType | NoteType[]) => void;
  onTogglePin: (note: Note) => void;
  onChangeNoteFolder: (noteId: string, folderId: string | null) => void;
  onDeleteNote: (note: Note) => void;
  searchFocusSignal?: number;
  typeFilter: 'all' | NoteType;
  onTypeFilterChange: (value: 'all' | NoteType) => void;
  advancedFilters: AdvancedFilters;
  onAdvancedFiltersChange: (filters: AdvancedFilters) => void;
  onClearAdvancedFilters: () => void;
  recentWork?: RecentWorkItem[];
  onSelectRecentWork?: (noteId: string) => void;
};

type FolderNode = Folder & { children: FolderNode[]; depth: number };
type FolderOption = Folder & { depth: number };

const COLLAPSED_STORAGE_KEY = 'urban-memo-collapsed-folders';
const DEFAULT_FOLDER_COLOR = '#f4f0e8';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function stripHtml(value: string) {
  if (!value) return '';
  const element = document.createElement('div');
  element.innerHTML = value;
  return element.textContent ?? '';
}

function buildFolderTree(folders: Folder[]): FolderNode[] {
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

  function makeNodes(parentId: string | null, depth: number): FolderNode[] {
    return (byParent.get(parentId) ?? []).map((folder) => ({
      ...folder,
      depth,
      children: makeNodes(folder.id, depth + 1)
    }));
  }

  return makeNodes(null, 0);
}

function flattenFolderTree(nodes: FolderNode[]): FolderOption[] {
  return nodes.flatMap((node) => [node, ...flattenFolderTree(node.children)]);
}

function collectDescendantIds(folderId: string, folders: Folder[]) {
  const ids = new Set<string>();
  let changed = true;

  folders.forEach((folder) => {
    if (folder.parent_id === folderId) ids.add(folder.id);
  });

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

function collectSelfAndDescendantIds(folderId: string, folders: Folder[]) {
  const ids = collectDescendantIds(folderId, folders);
  ids.add(folderId);
  return ids;
}

function loadCollapsedFolders() {
  try {
    const raw = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((item) => typeof item === 'string'));
  } catch {
    return new Set<string>();
  }
}

function saveCollapsedFolders(ids: Set<string>) {
  window.localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...ids]));
}

export default function NoteList({
  notes,
  allNotes,
  folders,
  selectedNoteId,
  selectedFolderId,
  searchTerm,
  onSearchTermChange,
  onSelectFolder,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onSelectNote,
  onCreateNote,
  onTogglePin,
  onChangeNoteFolder,
  onDeleteNote,
  searchFocusSignal = 0,
  typeFilter,
  onTypeFilterChange,
  advancedFilters,
  onAdvancedFiltersChange,
  onClearAdvancedFilters,
  recentWork = [],
  onSelectRecentWork
}: NoteListProps) {
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(DEFAULT_FOLDER_COLOR);
  const [newFolderParentId, setNewFolderParentId] = useState('');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<NoteType[]>(['song_analysis']);
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(() => loadCollapsedFolders());
  const [openFolderMenuId, setOpenFolderMenuId] = useState<string | null>(null);
  const [movingFolderId, setMovingFolderId] = useState<string | null>(null);
  const [movingNoteId, setMovingNoteId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const createFormRef = useRef<HTMLFormElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const folderTree = useMemo(() => buildFolderTree(folders), [folders]);
  const folderOptions = useMemo(() => flattenFolderTree(folderTree), [folderTree]);

  useEffect(() => {
    setCollapsedFolderIds((prev) => {
      const validIds = new Set(folders.map((folder) => folder.id));
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      if (next.size !== prev.size) saveCollapsedFolders(next);
      return next;
    });
  }, [folders]);

  useEffect(() => {
    if (showCreateFolder) {
      window.requestAnimationFrame(() => {
        createFormRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    }
  }, [showCreateFolder]);

  useEffect(() => {
    if (searchFocusSignal > 0) {
      window.requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [searchFocusSignal]);

  function focusSearchInput() {
    searchInputRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    searchInputRef.current?.focus();
  }

  const noteCountByFolder = useMemo(() => {
    const counts: Record<string, number> = {};
    folders.forEach((folder) => {
      const ids = collectSelfAndDescendantIds(folder.id, folders);
      counts[folder.id] = allNotes.filter((note) => note.folder_id && ids.has(note.folder_id)).length;
    });
    counts.unfiled = allNotes.filter((note) => note.folder_id === null).length;
    return counts;
  }, [allNotes, folders]);

  function handleCreateFolder(event: FormEvent) {
    event.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    onCreateFolder(name, newFolderColor, newFolderParentId || null);
    setNewFolderName('');
    setNewFolderParentId('');
    setNewFolderColor(DEFAULT_FOLDER_COLOR);
    setShowCreateFolder(false);
  }

  function handlePrepareChildFolder(folder: Folder) {
    setNewFolderParentId(folder.id);
    setNewFolderColor(folder.color || DEFAULT_FOLDER_COLOR);
    setShowCreateFolder(true);
    setOpenFolderMenuId(null);
  }

  function updateCollapsedFolders(next: Set<string>) {
    setCollapsedFolderIds(next);
    saveCollapsedFolders(next);
  }

  function toggleFolderCollapse(folder: Folder) {
    const next = new Set(collapsedFolderIds);
    if (next.has(folder.id)) next.delete(folder.id);
    else next.add(folder.id);
    updateCollapsedFolders(next);
  }

  function expandFolderAndDescendants(folder: Folder) {
    const idsToOpen = collectSelfAndDescendantIds(folder.id, folders);
    const next = new Set([...collapsedFolderIds].filter((id) => !idsToOpen.has(id)));
    updateCollapsedFolders(next);
  }

  function collapseAllFolders() {
    updateCollapsedFolders(new Set(folders.map((folder) => folder.id)));
  }

  function expandAllFolders() {
    updateCollapsedFolders(new Set());
  }

  function getFolderMoveOptions(folder: Folder) {
    const blockedIds = collectSelfAndDescendantIds(folder.id, folders);
    return folderOptions.filter((option) => !blockedIds.has(option.id));
  }

  function handleMoveFolder(folder: Folder, nextParentId: string) {
    const parentId = nextParentId || null;
    if (parentId === folder.parent_id) {
      setMovingFolderId(null);
      return;
    }
    onUpdateFolder(folder, { parent_id: parentId });
    setMovingFolderId(null);
  }

  function startRenameFolder(folder: Folder) {
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
    setMovingFolderId(null);
    setOpenFolderMenuId(null);
  }

  function cancelRenameFolder() {
    setEditingFolderId(null);
    setEditingFolderName('');
  }

  function submitRenameFolder(event: FormEvent, folder: Folder) {
    event.preventDefault();
    const nextName = editingFolderName.trim();
    if (!nextName) return;
    if (nextName !== folder.name) {
      onUpdateFolder(folder, { name: nextName });
    }
    cancelRenameFolder();
  }

  function handleMoveNote(note: Note, nextFolderId: string) {
    const folderId = nextFolderId || null;
    onChangeNoteFolder(note.id, folderId);
    setMovingNoteId(null);
  }

  function toggleTemplateSelection(templateId: NoteType) {
    setSelectedTemplateIds((current) => {
      if (current.includes(templateId)) {
        const next = current.filter((id) => id !== templateId);
        return next.length > 0 ? next : ['general'];
      }
      if (templateId === 'general') return ['general'];
      return [...current.filter((id) => id !== 'general'), templateId];
    });
  }

  function createNoteFromSelectedTemplates() {
    onCreateNote(selectedTemplateIds);
    setShowTemplatePicker(false);
  }


  const activeAdvancedFilterCount = useMemo(() => {
    return Object.values(advancedFilters).filter((value) => String(value ?? '').trim()).length;
  }, [advancedFilters]);

  function updateAdvancedFilter<K extends keyof AdvancedFilters>(key: K, value: AdvancedFilters[K]) {
    onAdvancedFiltersChange({ ...advancedFilters, [key]: value });
  }

  function applyBpmPreset(min: string, max: string) {
    onAdvancedFiltersChange({ ...advancedFilters, bpmMin: min, bpmMax: max });
  }

  function toggleAdvancedPreset(key: keyof AdvancedFilters, value: string) {
    const current = String(advancedFilters[key] ?? '');
    updateAdvancedFilter(key, current === value ? '' as never : value as never);
  }

  function renderSystemFolder(id: FolderFilter, label: string, count: number, tone: string) {
    return (
      <button
        type="button"
        className={`folder-system-row ${selectedFolderId === id ? 'active' : ''}`}
        onClick={() => onSelectFolder(id)}
      >
        <div className="folder-system-main">
          <span className="folder-system-dot" style={{ background: tone }} />
          <strong>{label}</strong>
        </div>
        <span className="folder-count-badge">{count}</span>
      </button>
    );
  }

  function renderFolderNode(node: FolderNode) {
    const isCollapsed = collapsedFolderIds.has(node.id);
    const hasChildren = node.children.length > 0;
    const moveOptions = getFolderMoveOptions(node);
    const menuOpen = openFolderMenuId === node.id;
    const isEditing = editingFolderId === node.id;
    const isMoving = movingFolderId === node.id;

    return (
      <div className="folder-node" key={node.id}>
        <div className="folder-item-shell" style={{ marginLeft: `${node.depth * 18}px` }}>
          <div className={`folder-item-card ${selectedFolderId === node.id ? 'active' : ''}`}>
            <div className="folder-item-row">
              <button
                type="button"
                className={`folder-chevron ${hasChildren ? '' : 'ghost'}`}
                onClick={() => hasChildren && toggleFolderCollapse(node)}
                disabled={!hasChildren}
                aria-label={hasChildren ? (isCollapsed ? '폴더 펼치기' : '폴더 접기') : '하위 폴더 없음'}
              >
                {hasChildren ? (isCollapsed ? '▸' : '▾') : '•'}
              </button>

              {isEditing ? (
                <form className="folder-inline-edit" onSubmit={(event) => submitRenameFolder(event, node)}>
                  <span className="folder-color-dot" style={{ background: node.color || DEFAULT_FOLDER_COLOR }} />
                  <input
                    value={editingFolderName}
                    onChange={(event) => setEditingFolderName(event.target.value)}
                    autoFocus
                    maxLength={40}
                  />
                  <button type="submit" className="icon-circle success">✓</button>
                  <button type="button" className="icon-circle" onClick={cancelRenameFolder}>×</button>
                </form>
              ) : (
                <button
                  type="button"
                  className="folder-main-button"
                  onClick={() => onSelectFolder(node.id)}
                >
                  <div className="folder-main-meta">
                    <span className="folder-color-dot" style={{ background: node.color || DEFAULT_FOLDER_COLOR }} />
                    <span className="folder-main-label">{node.name}</span>
                  </div>
                  <span className="folder-count-badge">{noteCountByFolder[node.id] ?? 0}</span>
                </button>
              )}

              {!isEditing && (
                <button
                  type="button"
                  className={`icon-circle menu-trigger ${menuOpen ? 'active' : ''}`}
                  onClick={() => {
                    setOpenFolderMenuId((current) => (current === node.id ? null : node.id));
                    setMovingFolderId(null);
                    setEditingFolderId(null);
                  }}
                  aria-label="폴더 메뉴 열기"
                >
                  ⋮
                </button>
              )}
            </div>

            {menuOpen && !isEditing && !isMoving && (
              <div className="folder-menu-panel">
                <button type="button" onClick={() => startRenameFolder(node)}>이름 변경</button>
                <button
                  type="button"
                  onClick={() => {
                    setMovingFolderId(node.id);
                    setOpenFolderMenuId(null);
                  }}
                >
                  이동
                </button>
                <label className="folder-color-menu">
                  <span>색상 변경</span>
                  <input
                    type="color"
                    value={node.color || DEFAULT_FOLDER_COLOR}
                    onChange={(event) => onUpdateFolder(node, { color: event.target.value })}
                    title="폴더 색상 변경"
                  />
                </label>
                <button type="button" onClick={() => handlePrepareChildFolder(node)}>하위 폴더 추가</button>
                {hasChildren && isCollapsed && (
                  <button type="button" onClick={() => expandFolderAndDescendants(node)}>전체 열기</button>
                )}
                <button type="button" className="danger" onClick={() => onDeleteFolder(node)}>삭제</button>
              </div>
            )}

            {isMoving && (
              <div className="folder-inline-panel">
                <label>
                  이동할 위치
                  <select value={node.parent_id ?? ''} onChange={(event) => handleMoveFolder(node, event.target.value)}>
                    <option value="">최상위 폴더</option>
                    {moveOptions.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {`${'— '.repeat(folder.depth)}${folder.name}`}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="panel-cancel" onClick={() => setMovingFolderId(null)}>취소</button>
              </div>
            )}
          </div>
        </div>

        {!isCollapsed && hasChildren && (
          <div className="folder-children">{node.children.map(renderFolderNode)}</div>
        )}
      </div>
    );
  }

  return (
    <aside className="sidebar sidebar-redesign">
      <header className="sidebar-header folder-page-header">
        <div>
          <div className="folder-page-title-row">
            <h1>폴더</h1>
            <span className="header-count-pill">{folders.length}</span>
          </div>
          <p>폴더를 정리하고 메모를 계층별로 관리하세요.</p>
        </div>
        <div className="header-actions">
          <button type="button" className="header-icon-button" title="메모 검색" onClick={focusSearchInput}>
            ⌕
          </button>
          <button
            type="button"
            className="header-icon-button primary"
            title="새 폴더 추가"
            onClick={() => setShowCreateFolder((current) => !current)}
          >
            +
          </button>
        </div>
      </header>

      <div className="folder-tip-banner">
        <span>✦ 타입별 템플릿으로 분석 데이터를 통일하고, 검색/필터로 작곡 재료를 빠르게 찾을 수 있어요.</span>
      </div>

      {recentWork.length > 0 && (
        <section className="recent-work-panel" aria-label="Recent work">
          <div className="recent-work-head">
            <strong>Recent Work</strong>
            <span>{recentWork.length}</span>
          </div>
          <div className="recent-work-list">
            {recentWork.slice(0, 5).map((item) => {
              const option = getNoteTypeOption(item.note_type);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectRecentWork?.(item.id)}
                  style={{ '--note-type-color': option.color } as CSSProperties}
                >
                  <i />
                  <span>
                    <strong>{item.title || 'Untitled'}</strong>
                    <em>{option.shortLabel} · {item.folderName}</em>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="folder-panel folder-panel-redesign" aria-label="Folders">
        <div className="folder-panel-header folder-panel-header-redesign">
          <div>
            <strong>Folders</strong>
            <span>{folders.length}</span>
          </div>
          <div className="folder-tree-controls">
            <button type="button" onClick={collapseAllFolders} disabled={folders.length === 0}>전체 접기</button>
            <button type="button" onClick={expandAllFolders} disabled={folders.length === 0}>전체 열기</button>
          </div>
        </div>

        <div className="folder-tree folder-tree-redesign">
          {renderSystemFolder('all', 'All Notes', allNotes.length, '#ff5c5c')}
          {renderSystemFolder('unfiled', 'Unfiled', noteCountByFolder.unfiled ?? 0, '#bcbcbc')}
          {folderTree.map(renderFolderNode)}
        </div>

        <button
          type="button"
          className="new-folder-trigger"
          onClick={() => {
            setShowCreateFolder((current) => !current);
            setNewFolderParentId('');
          }}
        >
          <span>＋</span>
          <strong>새 폴더</strong>
        </button>

        {showCreateFolder && (
          <form className="folder-create-card" onSubmit={handleCreateFolder} ref={createFormRef}>
            <div className="folder-create-card-header">
              <strong>폴더 추가</strong>
              <span>새 폴더를 만들고 위치를 지정하세요.</span>
            </div>

            <label>
              폴더 이름
              <input
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                placeholder="폴더 이름을 입력하세요"
                maxLength={40}
              />
            </label>

            <div className="folder-create-meta-row">
              <label>
                폴더 색상
                <div className="folder-color-picker-row">
                  <input
                    className="folder-create-color"
                    type="color"
                    value={newFolderColor}
                    onChange={(event) => setNewFolderColor(event.target.value)}
                    title="폴더 색상"
                  />
                  <span>{newFolderColor}</span>
                </div>
              </label>
            </div>

            <label>
              상위 폴더
              <select value={newFolderParentId} onChange={(event) => setNewFolderParentId(event.target.value)}>
                <option value="">상위 폴더 없음</option>
                {folderOptions.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {`${'— '.repeat(folder.depth)}${folder.name}`}
                  </option>
                ))}
              </select>
            </label>

            <div className="folder-create-actions">
              <button type="button" className="secondary-button" onClick={() => setShowCreateFolder(false)}>취소</button>
              <button type="submit" className="create-button">＋ 추가</button>
            </div>
          </form>
        )}
      </section>

      <input
        ref={searchInputRef}
        className="search-input search-input-redesign"
        value={searchTerm}
        onChange={(event) => onSearchTermChange(event.target.value)}
        placeholder="메모 검색"
      />

      <div className="type-filter-bar" aria-label="Note type filters">
        <button type="button" className={typeFilter === 'all' ? 'active' : ''} onClick={() => onTypeFilterChange('all')}>All</button>
        {NOTE_TYPE_OPTIONS.filter((option) => option.id !== 'general').map((option) => (
          <button
            key={option.id}
            type="button"
            className={typeFilter === option.id ? 'active' : ''}
            onClick={() => onTypeFilterChange(option.id)}
            style={{ borderColor: typeFilter === option.id ? option.color : undefined }}
          >
            {option.shortLabel}
          </button>
        ))}
      </div>

      <section className="advanced-filter-card">
        <button
          type="button"
          className="advanced-filter-toggle"
          onClick={() => setShowAdvancedFilters((current) => !current)}
        >
          <span>고급 필터</span>
          <em>{activeAdvancedFilterCount > 0 ? `${activeAdvancedFilterCount} active` : 'Genre · BPM · Key · Tag'}</em>
          <b>{showAdvancedFilters ? '▴' : '▾'}</b>
        </button>

        {activeAdvancedFilterCount > 0 && (
          <div className="active-filter-chip-row">
            {advancedFilters.genre && <button type="button" onClick={() => updateAdvancedFilter('genre', '')}>Genre: {advancedFilters.genre} ×</button>}
            {advancedFilters.mood && <button type="button" onClick={() => updateAdvancedFilter('mood', '')}>Mood: {advancedFilters.mood} ×</button>}
            {advancedFilters.section && <button type="button" onClick={() => updateAdvancedFilter('section', '')}>Section: {advancedFilters.section} ×</button>}
            {advancedFilters.key && <button type="button" onClick={() => updateAdvancedFilter('key', '')}>Key: {advancedFilters.key} ×</button>}
            {advancedFilters.harmony && <button type="button" onClick={() => updateAdvancedFilter('harmony', '')}>Harmony: {advancedFilters.harmony} ×</button>}
            {advancedFilters.instrument && <button type="button" onClick={() => updateAdvancedFilter('instrument', '')}>Inst: {advancedFilters.instrument} ×</button>}
            {advancedFilters.confidence && <button type="button" onClick={() => updateAdvancedFilter('confidence', '')}>Confidence: {advancedFilters.confidence} ×</button>}
            {advancedFilters.tag && <button type="button" onClick={() => updateAdvancedFilter('tag', '')}>Tag: #{advancedFilters.tag.replace(/^#/, '')} ×</button>}
            {(advancedFilters.bpmMin || advancedFilters.bpmMax) && <button type="button" onClick={() => onAdvancedFiltersChange({ ...advancedFilters, bpmMin: '', bpmMax: '' })}>BPM: {advancedFilters.bpmMin || '0'}-{advancedFilters.bpmMax || '+'} ×</button>}
          </div>
        )}

        {showAdvancedFilters && (
          <div className="advanced-filter-panel">
            <div className="filter-field">
              <label>Genre</label>
              <input list="genre-presets" value={advancedFilters.genre} onChange={(event) => updateAdvancedFilter('genre', event.target.value)} placeholder="K-pop" />
              <datalist id="genre-presets">{GENRE_PRESETS.map((item) => <option key={item} value={item} />)}</datalist>
            </div>
            <div className="filter-field">
              <label>Mood</label>
              <input list="mood-presets" value={advancedFilters.mood} onChange={(event) => updateAdvancedFilter('mood', event.target.value)} placeholder="청량" />
              <datalist id="mood-presets">{MOOD_PRESETS.map((item) => <option key={item} value={item} />)}</datalist>
            </div>
            <div className="filter-field">
              <label>Section</label>
              <input list="section-presets" value={advancedFilters.section} onChange={(event) => updateAdvancedFilter('section', event.target.value)} placeholder="Chorus" />
              <datalist id="section-presets">{SECTION_PRESETS.map((item) => <option key={item} value={item} />)}</datalist>
            </div>
            <div className="filter-field">
              <label>Key</label>
              <input list="key-presets" value={advancedFilters.key} onChange={(event) => updateAdvancedFilter('key', event.target.value)} placeholder="B Major" />
              <datalist id="key-presets">{KEY_PRESETS.map((item) => <option key={item} value={item} />)}</datalist>
            </div>
            <div className="filter-field">
              <label>Harmony</label>
              <input list="harmony-presets" value={advancedFilters.harmony} onChange={(event) => updateAdvancedFilter('harmony', event.target.value)} placeholder="Modal Interchange" />
              <datalist id="harmony-presets">{HARMONY_PRESETS.map((item) => <option key={item} value={item} />)}</datalist>
            </div>
            <div className="filter-field">
              <label>Instrument</label>
              <input list="instrument-presets" value={advancedFilters.instrument} onChange={(event) => updateAdvancedFilter('instrument', event.target.value)} placeholder="EP Pluck" />
              <datalist id="instrument-presets">{INSTRUMENT_PRESETS.map((item) => <option key={item} value={item} />)}</datalist>
            </div>
            <div className="filter-field">
              <label>Confidence</label>
              <select value={advancedFilters.confidence} onChange={(event) => updateAdvancedFilter('confidence', event.target.value as AdvancedFilters['confidence'])}>
                <option value="">Any</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div className="filter-field">
              <label>Tag</label>
              <input value={advancedFilters.tag} onChange={(event) => updateAdvancedFilter('tag', event.target.value)} placeholder="NCTWISH / 청량" />
            </div>

            <div className="filter-field bpm-filter-field">
              <label>BPM Range</label>
              <div className="bpm-range-inputs">
                <input value={advancedFilters.bpmMin} onChange={(event) => updateAdvancedFilter('bpmMin', event.target.value)} inputMode="numeric" placeholder="Min" />
                <span>—</span>
                <input value={advancedFilters.bpmMax} onChange={(event) => updateAdvancedFilter('bpmMax', event.target.value)} inputMode="numeric" placeholder="Max" />
              </div>
              <div className="bpm-preset-row">
                {BPM_PRESETS.map((preset) => (
                  <button key={preset.label} type="button" onClick={() => applyBpmPreset(preset.min, preset.max)}>
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="preset-filter-row">
              {[...GENRE_PRESETS.slice(0, 4), ...HARMONY_PRESETS.slice(1, 4)].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleAdvancedPreset(GENRE_PRESETS.includes(item) ? 'genre' : 'harmony', item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <button type="button" className="clear-filter-button" onClick={onClearAdvancedFilters} disabled={activeAdvancedFilterCount === 0}>
              필터 초기화
            </button>
          </div>
        )}
      </section>

      <div className="sidebar-subheader">
        <strong>메모</strong>
        <button type="button" className="new-note-button" onClick={() => setShowTemplatePicker((current) => !current)}>새 메모</button>
      </div>

      <div className="quick-create-row-v52">
        <button type="button" onClick={() => onCreateNote('song_analysis')}>+ Song Analysis</button>
        <button type="button" onClick={() => onCreateNote('chord_progression')}>+ Chord Idea</button>
        <button type="button" onClick={() => onCreateNote('rhythm_pattern')}>+ Rhythm</button>
        <button type="button" onClick={() => onCreateNote('demo_idea')}>+ Demo Plan</button>
        <button type="button" className="custom-mix" onClick={() => setShowTemplatePicker((current) => !current)}>Custom Mix</button>
      </div>

      {showTemplatePicker && (
        <div className="template-picker-card multi-template-picker">
          <div className="template-picker-head">
            <div>
              <strong>분석 템플릿 선택</strong>
              <span>하나 또는 여러 템플릿을 선택해서 한 메모에 합칠 수 있어요.</span>
            </div>
            <em>{selectedTemplateIds.length} selected</em>
          </div>

          <div className="template-grid">
            {NOTE_TYPE_OPTIONS.map((option) => {
              const selected = selectedTemplateIds.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  className={selected ? 'selected' : ''}
                  onClick={() => toggleTemplateSelection(option.id)}
                  style={{ borderColor: selected ? option.color : undefined }}
                >
                  <i style={{ background: option.color }} />
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                  <b>{selected ? '✓' : '+'}</b>
                </button>
              );
            })}
          </div>

          <div className="template-picker-actions">
            <button type="button" className="secondary-button" onClick={() => setShowTemplatePicker(false)}>
              취소
            </button>
            <button type="button" className="create-button" onClick={createNoteFromSelectedTemplates}>
              선택한 템플릿으로 메모 만들기
            </button>
          </div>
        </div>
      )}

      <div className="note-list">
        {notes.length === 0 ? (
          <div className="empty-state improved-empty-state">
            <strong>검색 결과가 없습니다.</strong>
            <span>필터를 줄이거나 새 분석 메모를 만들어보세요.</span>
            <div className="empty-state-actions">
              <button type="button" onClick={onClearAdvancedFilters}>필터 초기화</button>
              <button type="button" onClick={() => onCreateNote('song_analysis')}>Song Analysis 만들기</button>
            </div>
          </div>
        ) : (
          notes.map((note) => {
            const preview = stripHtml(note.content);
            const primaryMetaChips = [note.metadata?.genre, note.metadata?.bpm ? `${note.metadata.bpm} BPM` : '', note.metadata?.key, note.metadata?.section].filter(Boolean);
            const secondaryMetaChips = [note.metadata?.mood, note.metadata?.harmony, note.metadata?.confidence].filter(Boolean);
            const visibleMetaChips = [...primaryMetaChips, ...secondaryMetaChips].slice(0, 5);
            const hiddenMetaCount = Math.max(0, primaryMetaChips.length + secondaryMetaChips.length - visibleMetaChips.length);
            const noteTags = splitTags(note.metadata?.tags);
            const visibleTags = noteTags.slice(0, 2);
            const hiddenTagCount = Math.max(0, noteTags.length - visibleTags.length);
            return (
              <article
                key={note.id}
                className={`note-row note-row-colored ${selectedNoteId === note.id ? 'selected' : ''}`}
                style={{ '--note-type-color': getNoteTypeOption(note.note_type).color } as CSSProperties}
                onClick={() => onSelectNote(note)}
              >
                <div className="note-row-main">
                  <div className="note-row-title">
                    {note.is_pinned && <span className="pin-badge">Pinned</span>}
                    <span className="note-type-badge" style={{ borderColor: getNoteTypeOption(note.note_type).color, color: getNoteTypeOption(note.note_type).color }}>
                      {getNoteTypeOption(note.note_type).shortLabel}
                    </span>
                    <strong>{note.title || 'Untitled'}</strong>
                  </div>
                  <p>{preview || 'No content yet'}</p>
                  <div className="note-meta-chips compact-note-meta">
                    {visibleMetaChips.map((chip) => <b key={String(chip)}>{chip}</b>)}
                    {hiddenMetaCount > 0 && <b className="more-chip">+{hiddenMetaCount}</b>}
                  </div>
                  {noteTags.length > 0 && (
                    <div className="note-tag-row compact-note-tags" onClick={(event) => event.stopPropagation()}>
                      {visibleTags.map((tag) => (
                        <button key={tag} type="button" onClick={() => updateAdvancedFilter('tag', tag)}>
                          #{tag.replace(/^#/, '')}
                        </button>
                      ))}
                      {hiddenTagCount > 0 && <button type="button" className="more-tag-chip">+{hiddenTagCount}</button>}
                    </div>
                  )}
                  <span>{formatDate(note.updated_at)}</span>
                </div>
                <div className="note-row-actions" onClick={(event) => event.stopPropagation()}>
                  <button type="button" onClick={() => onTogglePin(note)}>{note.is_pinned ? 'Unpin' : 'Pin'}</button>
                  <button type="button" onClick={() => setMovingNoteId((current) => (current === note.id ? null : note.id))}>Move</button>
                  <button type="button" className="danger" onClick={() => onDeleteNote(note)}>Delete</button>
                </div>

                {movingNoteId === note.id && (
                  <div className="note-move-panel" onClick={(event) => event.stopPropagation()}>
                    <label>
                      Move to
                      <select value={note.folder_id ?? ''} onChange={(event) => handleMoveNote(note, event.target.value)}>
                        <option value="">Unfiled</option>
                        {folderOptions.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {`${'— '.repeat(folder.depth)}${folder.name}`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="button" onClick={() => setMovingNoteId(null)}>Cancel</button>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </aside>
  );
}
