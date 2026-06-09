import { useEffect, useMemo, useState } from 'react';
import { CHORD_KEY_OPTIONS, makeChordNoteHtml, progressionToBars, transposeChordProgression } from '../lib/chordTranspose';

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
};

export default function ChordTransposeWidget({
  seedProgression = '',
  openSignal = 0,
  onSaveTransposedChordNote
}: ChordTransposeWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [originalKey, setOriginalKey] = useState('B Major');
  const [targetKey, setTargetKey] = useState('D Major');
  const [progression, setProgression] = useState(seedProgression || 'Bmaj9 - F#/A# - G#m7 - Emaj9');
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    if (!seedProgression.trim()) return;
    setProgression(seedProgression);
    setIsOpen(true);
  }, [seedProgression, openSignal]);

  const transposedProgression = useMemo(() => {
    return transposeChordProgression(progression, originalKey, targetKey);
  }, [progression, originalKey, targetKey]);

  async function copyTransposedProgression() {
    try {
      await navigator.clipboard.writeText(transposedProgression);
      setCopyStatus('Copied');
    } catch {
      setCopyStatus('Copy failed');
    }
    window.setTimeout(() => setCopyStatus(''), 1400);
  }

  function saveTransposedProgression() {
    if (!progression.trim() || !transposedProgression.trim()) return;
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

  return (
    <aside className={`floating-chord-widget ${isOpen ? 'open' : 'collapsed'}`} aria-label="Chord transpose tool">
      <button type="button" className="floating-chord-trigger" onClick={() => setIsOpen((value) => !value)}>
        <span>♬</span>
        <strong>Chord Transpose</strong>
        <em>{isOpen ? '접기' : '열기'}</em>
      </button>

      {isOpen && (
        <div className="floating-chord-panel">
          <header>
            <div>
              <strong>Chord Transpose Tool</strong>
              <span>대시보드와 상관없이 항상 사용할 수 있어요.</span>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="Close chord transpose tool">
              ×
            </button>
          </header>

          <div className="floating-transpose-grid">
            <label>
              Original Key
              <select value={originalKey} onChange={(event) => setOriginalKey(event.target.value)}>
                {CHORD_KEY_OPTIONS.map((key) => <option key={key} value={key}>{key}</option>)}
              </select>
            </label>
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
            <small>{progressionToBars(transposedProgression).join(' | ')}</small>
          </div>

          <div className="floating-transpose-actions">
            <button type="button" onClick={copyTransposedProgression}>Copy</button>
            <button type="button" onClick={saveTransposedProgression}>Save as Chord Note</button>
            {copyStatus && <span>{copyStatus}</span>}
          </div>
        </div>
      )}
    </aside>
  );
}
