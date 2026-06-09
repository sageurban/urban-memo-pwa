import { FormEvent, useMemo, useState } from 'react';
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
  onDeleteNote: (note: Note) => void;
};

type FolderNode = Folder & { children: FolderNode[]; depth: number };

type FolderOption = Folder & { depth: number };

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
  const ids = new Set<string>([folderId]);
  let changed = true;

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
  onDeleteNote
}: NoteListProps) {
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#f4f0e8');
  const [newFolderParentId, setNewFolderParentId] = useState('');

  const folderTree = useMemo(() => buildFolderTree(folders), [folders]);
  const folderOptions = useMemo(() => flattenFolderTree(folderTree), [folderTree]);

  const noteCountByFolder = useMemo(() => {
    const counts: Record<string, number> = {};
    folders.forEach((folder) => {
      const ids = collectDescendantIds(folder.id, folders);
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

  function renderFolderNode(node: FolderNode) {
    return (
      <div className="folder-node" key={node.id}>
        <div className="folder-row-wrap" style={{ paddingLeft: `${node.depth * 14}px` }}>
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
            className="folder-delete"
            onClick={() => onDeleteFolder(node)}
            title="Delete folder"
          >
            ×
          </button>
        </div>
        {node.children.map(renderFolderNode)}
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
          <strong>Folders</strong>
          <span>{folders.length}</span>
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
                  <button type="button" className="danger" onClick={() => onDeleteNote(note)}>
                    Delete
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </aside>
  );
}
