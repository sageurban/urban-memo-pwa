import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Folder, Note } from '../types/note';

type FolderFilter = 'all' | 'unfiled' | string;

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
  onCreateNote: () => void;
  onTogglePin: (note: Note) => void;
  onChangeNoteFolder: (noteId: string, folderId: string | null) => void;
  onDeleteNote: (note: Note) => void;
};

type FolderNode = Folder & { children: FolderNode[]; depth: number };

type FolderOption = Folder & { depth: number };

const COLLAPSED_STORAGE_KEY = 'urban-memo-collapsed-folders';

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
  onDeleteNote
}: NoteListProps) {
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#f4f0e8');
  const [newFolderParentId, setNewFolderParentId] = useState('');
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(() => loadCollapsedFolders());
  const [movingFolderId, setMovingFolderId] = useState<string | null>(null);
  const [movingNoteId, setMovingNoteId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');

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
  }

  function handlePrepareChildFolder(folder: Folder) {
    setNewFolderParentId(folder.id);
    setNewFolderColor(folder.color || '#f4f0e8');
  }

  function updateCollapsedFolders(next: Set<string>) {
    setCollapsedFolderIds(next);
    saveCollapsedFolders(next);
  }

  function collapseFolder(folder: Folder) {
    const next = new Set(collapsedFolderIds);
    next.add(folder.id);
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

  function renderFolderNode(node: FolderNode) {
    const isCollapsed = collapsedFolderIds.has(node.id);
    const hasChildren = node.children.length > 0;
    const moveOptions = getFolderMoveOptions(node);

    return (
      <div className="folder-node" key={node.id}>
        <div className="folder-row-wrap" style={{ paddingLeft: `${node.depth * 14}px` }}>
          <button
            type="button"
            className="folder-collapse"
            onClick={() => (isCollapsed ? expandFolderAndDescendants(node) : collapseFolder(node))}
            disabled={!hasChildren}
            title={hasChildren ? (isCollapsed ? '하위 폴더 모두 열기' : '하위 폴더 접기') : '하위 폴더 없음'}
            aria-label={hasChildren ? (isCollapsed ? '하위 폴더 모두 열기' : '하위 폴더 접기') : '하위 폴더 없음'}
          >
            {hasChildren ? (isCollapsed ? '▸' : '▾') : '•'}
          </button>

          <button
            type="button"
            className={`folder-row ${selectedFolderId === node.id ? 'active' : ''}`}
            onClick={() => onSelectFolder(node.id)}
          >
            <span className="folder-name" style={{ color: node.color || '#f4f0e8' }}>
              <i style={{ background: node.color || '#f4f0e8' }} />
              {node.name}
            </span>
            <em>{noteCountByFolder[node.id] ?? 0}</em>
          </button>

          <input
            className="folder-color-input"
            type="color"
            value={node.color || '#f4f0e8'}
            onChange={(event) => onUpdateFolder(node, { color: event.target.value })}
            title="Change folder color"
          />

          <button
            type="button"
            className="folder-child"
            onClick={() => handlePrepareChildFolder(node)}
            title="Create child folder here"
          >
            +
          </button>

          <button
            type="button"
            className="folder-rename"
            onClick={() => startRenameFolder(node)}
            title="Rename folder"
          >
            Rename
          </button>

          <button
            type="button"
            className="folder-move"
            onClick={() => {
              setMovingFolderId((current) => (current === node.id ? null : node.id));
              setEditingFolderId(null);
            }}
            title="Move folder"
          >
            Move
          </button>

          <button
            type="button"
            className="folder-delete"
            onClick={() => onDeleteFolder(node)}
            title="Delete folder"
          >
            ×
          </button>
        </div>

        {editingFolderId === node.id && (
          <form className="folder-rename-panel" style={{ marginLeft: `${node.depth * 14 + 28}px` }} onSubmit={(event) => submitRenameFolder(event, node)}>
            <label>
              Rename
              <input
                value={editingFolderName}
                onChange={(event) => setEditingFolderName(event.target.value)}
                maxLength={40}
                autoFocus
              />
            </label>
            <button type="submit">Save</button>
            <button type="button" onClick={cancelRenameFolder}>
              Cancel
            </button>
          </form>
        )}

        {movingFolderId === node.id && (
          <div className="folder-move-panel" style={{ marginLeft: `${node.depth * 14 + 28}px` }}>
            <label>
              Move to
              <select value={node.parent_id ?? ''} onChange={(event) => handleMoveFolder(node, event.target.value)}>
                <option value="">Top level</option>
                {moveOptions.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {`${'— '.repeat(folder.depth)}${folder.name}`}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => setMovingFolderId(null)}>
              Cancel
            </button>
          </div>
        )}

        {!isCollapsed && node.children.map(renderFolderNode)}
      </div>
    );
  }

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <div>
          <h1>Urban Memo</h1>
          <p>{allNotes.length} notes</p>
        </div>
        <button type="button" className="new-button" onClick={onCreateNote}>
          +
        </button>
      </header>

      <section className="folder-panel" aria-label="Folders">
        <div className="folder-panel-header">
          <div>
            <strong>Folders</strong>
            <span>{folders.length}</span>
          </div>
          <div className="folder-tree-controls">
            <button type="button" onClick={collapseAllFolders} disabled={folders.length === 0}>
              접기
            </button>
            <button type="button" onClick={expandAllFolders} disabled={folders.length === 0}>
              열기
            </button>
          </div>
        </div>

        <button
          type="button"
          className={`folder-row ${selectedFolderId === 'all' ? 'active' : ''}`}
          onClick={() => onSelectFolder('all')}
        >
          <span>All Notes</span>
          <em>{allNotes.length}</em>
        </button>

        <button
          type="button"
          className={`folder-row ${selectedFolderId === 'unfiled' ? 'active' : ''}`}
          onClick={() => onSelectFolder('unfiled')}
        >
          <span>Unfiled</span>
          <em>{noteCountByFolder.unfiled ?? 0}</em>
        </button>

        <div className="folder-tree">{folderTree.map(renderFolderNode)}</div>

        <form className="folder-form folder-form-rich" onSubmit={handleCreateFolder}>
          <input
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            placeholder="New folder"
            maxLength={40}
          />
          <input
            className="folder-create-color"
            type="color"
            value={newFolderColor}
            onChange={(event) => setNewFolderColor(event.target.value)}
            title="Folder color"
          />
          <select value={newFolderParentId} onChange={(event) => setNewFolderParentId(event.target.value)}>
            <option value="">No parent</option>
            {folderOptions.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {`${'— '.repeat(folder.depth)}${folder.name}`}
              </option>
            ))}
          </select>
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
          notes.map((note) => {
            const preview = stripHtml(note.content);
            return (
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
                  <p>{preview || 'No content yet'}</p>
                  <span>{formatDate(note.updated_at)}</span>
                </div>
                <div className="note-row-actions" onClick={(event) => event.stopPropagation()}>
                  <button type="button" onClick={() => onTogglePin(note)}>
                    {note.is_pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovingNoteId((current) => (current === note.id ? null : note.id))}
                  >
                    Move
                  </button>
                  <button type="button" className="danger" onClick={() => onDeleteNote(note)}>
                    Delete
                  </button>
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
                    <button type="button" onClick={() => setMovingNoteId(null)}>
                      Cancel
                    </button>
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
