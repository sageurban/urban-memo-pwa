import { useEffect, useMemo, useState } from 'react';
import { CHORD_KEY_OPTIONS, makeChordNoteHtml, progressionToBars, transposeChordProgression } from '../lib/chordTranspose';

type InsertPayload = {
  transposedProgression: string;
  fullAnalysis: string;
  songSection: string;
};

type ChordTransposeWidgetProps = {
  seedProgression?: string;
  openSignal?: number;
  onSaveTransposedChordNote: (payload: {
    originalKey: string;
    targetKey: string;
    originalProgression: string;
    transposedProgression: string;
    content: string;
  }) => void;
  onInsertIntoCurrentNote?: (payload: InsertPayload) => void;
};

const RECENT_STORAGE_KEY = 'urban-music-recent-transpose-history';
const KEY_STORAGE_KEY = 'urban-music-transpose-keys';

type RecentItem = {
  originalKey: string;
  targetKey: string;
  progression: string;
  result: string;
};

function loadRecentHistory(): RecentItem[] {
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
  } catch {
    return [];
  }
}

function loadStoredKeys() {
  try {
    const raw = window.localStorage.getItem(KEY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.originalKey || !parsed?.targetKey) return null;
    return parsed as { originalKey: string; targetKey: string };
  } catch {
    return null;
  }
}

export default function ChordTransposeWidget({
  seedProgression = '',
  openSignal = 0,
  onSaveTransposedChordNote,
  onInsertIntoCurrentNote
}: ChordTransposeWidgetProps) {
  const storedKeys = loadStoredKeys();
  const [isOpen, setIsOpen] = useState(false);
  const [originalKey, setOriginalKey] = useState(storedKeys?.originalKey ?? 'B Major');
  const [targetKey, setTargetKey] = useState(storedKeys?.targetKey ?? 'D Major');
  const [progression, setProgression] = useState(seedProgression || 'Bmaj9 - F#/A# - G#m7 - Emaj9');
  const [copyStatus, setCopyStatus] = useState('');
  const [recentHistory, setRecentHistory] = useState<RecentItem[]>(() => loadRecentHistory());

  useEffect(() => {
    if (!seedProgression.trim()) return;
    setProgression(seedProgression);
    setIsOpen(true);
  }, [seedProgression, openSignal]);

  useEffect(() => {
    if (openSignal > 0) setIsOpen(true);
  }, [openSignal]);

  useEffect(() => {
    window.localStorage.setItem(KEY_STORAGE_KEY, JSON.stringify({ originalKey, targetKey }));
  }, [originalKey, targetKey]);

  const transposedProgression = useMemo(() => {
    return transposeChordProgression(progression, originalKey, targetKey);
  }, [progression, originalKey, targetKey]);

  const barText = useMemo(() => progressionToBars(transposedProgression).join(' | '), [transposedProgression]);

  const fullAnalysis = useMemo(() => {
    return [
      `Original Key: ${originalKey}`,
      `Target Key: ${targetKey}`,
      `Original Progression: ${progression}`,
      `Transposed Progression: ${transposedProgression}`,
      `Bar Format: ${barText}`
    ].join('\n');
  }, [originalKey, targetKey, progression, transposedProgression, barText]);

  const songSection = useMemo(() => {
    return [`[Chord Section]`, barText || transposedProgression].join('\n');
  }, [barText, transposedProgression]);

  function rememberCurrent() {
    if (!progression.trim() || !transposedProgression.trim()) return;
    const nextItem = { originalKey, targetKey, progression, result: transposedProgression };
    const next = [nextItem, ...recentHistory.filter((item) => item.progression !== progression || item.targetKey !== targetKey)].slice(0, 6);
    setRecentHistory(next);
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
  }

  async function copyText(text: string, label = 'Copied') {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(label);
      rememberCurrent();
    } catch {
      setCopyStatus('Copy failed');
    }
    window.setTimeout(() => setCopyStatus(''), 1400);
  }

  function saveTransposedProgression() {
    if (!progression.trim() || !transposedProgression.trim()) return;
    rememberCurrent();
    onSaveTransposedChordNote({
      originalKey,
      targetKey,
      originalProgression: progression,
      transposedProgression,
      content: makeChordNoteHtml(originalKey, targetKey, progression, transposedProgression)
    });
    setCopyStatus('Saved as Chord Note');
    window.setTimeout(() => setCopyStatus(''), 1600);
  }

  function insertIntoCurrentNote() {
    if (!onInsertIntoCurrentNote) return;
    rememberCurrent();
    onInsertIntoCurrentNote({ transposedProgression, fullAnalysis, songSection });
    setCopyStatus('Inserted');
    window.setTimeout(() => setCopyStatus(''), 1400);
  }

  function swapKeys() {
    setOriginalKey(targetKey);
    setTargetKey(originalKey);
  }

  function useRecent(item: RecentItem) {
    setOriginalKey(item.originalKey);
    setTargetKey(item.targetKey);
    setProgression(item.progression);
    setIsOpen(true);
  }

  return (
    <aside className={`floating-chord-widget ${isOpen ? 'open' : 'collapsed'}`} aria-label="Chord transpose tool">
      <button type="button" className="floating-chord-trigger" onClick={() => setIsOpen((value) => !value)}>
        <span>♬</span>
        <strong>Chord Transpose</strong>
        <em>{isOpen ? '접기' : '열기'}</em>
      </button>

      {isOpen && (
        <div className="floating-chord-panel v5-chord-panel">
          <header>
            <div>
              <strong>Chord Transpose</strong>
              <span>복사, 삽입, 코드 메모 저장까지 바로 처리합니다.</span>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="Close chord transpose tool">
              ×
            </button>
          </header>

          <div className="floating-transpose-grid v5-transpose-grid">
            <label>
              Original Key
              <select value={originalKey} onChange={(event) => setOriginalKey(event.target.value)}>
                {CHORD_KEY_OPTIONS.map((key) => <option key={key} value={key}>{key}</option>)}
              </select>
            </label>
            <button type="button" className="key-swap-button" onClick={swapKeys} title="Swap keys">⇄</button>
            <label>
              Target Key
              <select value={targetKey} onChange={(event) => setTargetKey(event.target.value)}>
                {CHORD_KEY_OPTIONS.map((key) => <option key={key} value={key}>{key}</option>)}
              </select>
            </label>
          </div>

          <label className="floating-textarea-label">
            Chord Progression
            <textarea
              value={progression}
              onChange={(event) => setProgression(event.target.value)}
              placeholder="Bmaj9 - F#/A# - G#m7 - Emaj9"
            />
          </label>

          <div className="floating-transpose-result">
            <span>Result</span>
            <strong>{transposedProgression || 'Enter progression'}</strong>
            <small>{barText}</small>
          </div>

          <div className="copy-format-grid">
            <button type="button" onClick={() => copyText(transposedProgression, 'Chords copied')}>Copy Chords</button>
            <button type="button" onClick={() => copyText(fullAnalysis, 'Full copied')}>Copy Full</button>
            <button type="button" onClick={() => copyText(songSection, 'Section copied')}>Copy Section</button>
          </div>

          <div className="floating-transpose-actions v5-transpose-actions">
            <button type="button" onClick={insertIntoCurrentNote}>Insert to Current Note</button>
            <button type="button" onClick={saveTransposedProgression}>Save as Chord Note</button>
            {copyStatus && <span>{copyStatus}</span>}
          </div>

          {recentHistory.length > 0 && (
            <div className="transpose-history">
              <strong>Recent</strong>
              {recentHistory.map((item, index) => (
                <button type="button" key={`${item.progression}-${index}`} onClick={() => useRecent(item)}>
                  <span>{item.progression}</span>
                  <em>{item.targetKey}</em>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
