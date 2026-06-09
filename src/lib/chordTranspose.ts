export const CHORD_KEY_OPTIONS = [
  'C Major', 'G Major', 'D Major', 'A Major', 'E Major', 'B Major', 'F# Major', 'C# Major',
  'F Major', 'Bb Major', 'Eb Major', 'Ab Major', 'Db Major', 'Gb Major',
  'A minor', 'E minor', 'B minor', 'F# minor', 'C# minor', 'G# minor', 'D# minor',
  'D minor', 'G minor', 'C minor', 'F minor', 'Bb minor', 'Eb minor'
];

const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const NOTE_TO_INDEX: Record<string, number> = {
  C: 0,
  'B#': 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  'E#': 5,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
  Cb: 11
};

const FLAT_KEY_NAMES = new Set([
  'F Major', 'Bb Major', 'Eb Major', 'Ab Major', 'Db Major', 'Gb Major', 'Cb Major',
  'D minor', 'G minor', 'C minor', 'F minor', 'Bb minor', 'Eb minor', 'Ab minor'
]);

function normalizeIndex(value: number) {
  return ((value % 12) + 12) % 12;
}

export function getKeyRoot(keyName: string) {
  const root = keyName.trim().split(/\s+/)[0] || 'C';
  return NOTE_TO_INDEX[root] ?? 0;
}

function shouldPreferFlats(targetKey: string) {
  return FLAT_KEY_NAMES.has(targetKey);
}

export function transposeNote(noteName: string, semitoneShift: number, targetKey: string) {
  const root = NOTE_TO_INDEX[noteName];
  if (root == null) return noteName;
  const nextIndex = normalizeIndex(root + semitoneShift);
  return shouldPreferFlats(targetKey) ? FLAT_NOTES[nextIndex] : SHARP_NOTES[nextIndex];
}

export function transposeChord(chord: string, semitoneShift: number, targetKey: string) {
  const trimmed = chord.trim();
  if (!trimmed) return chord;

  const match = trimmed.match(/^([A-G](?:#|b)?)(.*)$/);
  if (!match) return chord;

  const [, root, rest] = match;
  const slashIndex = rest.indexOf('/');
  const suffix = slashIndex >= 0 ? rest.slice(0, slashIndex) : rest;
  const bass = slashIndex >= 0 ? rest.slice(slashIndex + 1) : '';

  const transposedRoot = transposeNote(root, semitoneShift, targetKey);
  const transposedBass = bass ? transposeNote(bass, semitoneShift, targetKey) : '';

  return `${transposedRoot}${suffix}${transposedBass ? `/${transposedBass}` : ''}`;
}

export function transposeChordProgression(progression: string, originalKey: string, targetKey: string) {
  const semitoneShift = getKeyRoot(targetKey) - getKeyRoot(originalKey);

  return progression.replace(/[A-G](?:#|b)?(?:maj|min|m|dim|aug|sus|add|M)?[0-9#b()]*[A-Za-z0-9#b()]*?(?:\/[A-G](?:#|b)?)?/g, (token) => {
    return transposeChord(token, semitoneShift, targetKey);
  });
}

export function progressionToBars(progression: string) {
  return progression
    .split(/\s*\|\s*|\s*-\s*|\s*→\s*|\s*,\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function makeChordNoteHtml(originalKey: string, targetKey: string, original: string, result: string) {
  return [
    '<h2>Chord Transpose Result</h2>',
    `<p><strong>Original Key:</strong> ${originalKey}</p>`,
    `<p><strong>Target Key:</strong> ${targetKey}</p>`,
    '<h2>Original Progression</h2>',
    `<p>${original}</p>`,
    '<h2>Transposed Progression</h2>',
    `<p>${result}</p>`,
    '<h2>Copy Format</h2>',
    `<p>[Chord Progression - ${targetKey}]<br>${result}</p>`,
    '<h2>Notes</h2>',
    '<ul><li>Slash chords are transposed root and bass separately.</li><li>Enharmonic spelling follows the target key preference.</li></ul>'
  ].join('');
}
