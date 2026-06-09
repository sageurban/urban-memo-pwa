import { useMemo, useState } from 'react';
import { AudioFile, AudioMarker, Note } from '../types/note';
import { AdvancedFilters, getNoteTypeOption, NOTE_TYPE_OPTIONS, NoteType, splitTags } from '../lib/musicTemplates';

type TypeFilter = 'all' | NoteType;

type MusicDashboardProps = {
  notes: Note[];
  audioFiles: AudioFile[];
  audioMarkers: AudioMarker[];
  onApplyFilters: (filters: Partial<AdvancedFilters>, typeFilter?: TypeFilter) => void;
  onOpenChordTool: (progression?: string) => void;
};

type CountItem = {
  label: string;
  count: number;
  value?: string;
};

const BPM_BUCKETS = [
  { label: '80-99', min: 80, max: 99 },
  { label: '100-119', min: 100, max: 119 },
  { label: '120-129', min: 120, max: 129 },
  { label: '130-145', min: 130, max: 145 },
  { label: '146+', min: 146, max: Number.POSITIVE_INFINITY }
];

function clean(value?: string | null) {
  return String(value ?? '').trim();
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  values
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, value: label }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function topItems(items: CountItem[], limit = 5) {
  return items.slice(0, limit);
}

function getBpmNumber(value?: string) {
  const number = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function stripHtml(value: string) {
  if (!value) return '';
  const element = document.createElement('div');
  element.innerHTML = value;
  return element.textContent ?? '';
}

function extractProgressionSnippets(notes: Note[], markers: AudioMarker[]) {
  const fromMarkers = markers
    .map((marker) => clean(marker.chord_progression))
    .filter(Boolean);

  const fromChordNotes = notes
    .filter((note) => note.note_type === 'chord_progression')
    .map((note) => {
      const text = stripHtml(note.content);
      const progressionLine = text
        .split(/\n|\r/)
        .map((line) => line.trim())
        .find((line) => /^Progression:/i.test(line));
      return progressionLine?.replace(/^Progression:\s*/i, '') ?? '';
    })
    .filter(Boolean);

  return topItems(countBy([...fromMarkers, ...fromChordNotes]), 5);
}

function percent(count: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(4, Math.round((count / total) * 100));
}

export default function MusicDashboard({
  notes,
  audioFiles,
  audioMarkers,
  onApplyFilters,
  onOpenChordTool
}: MusicDashboardProps) {
  const [isOpen, setIsOpen] = useState(true);

  const stats = useMemo(() => {
    const typeCounts = NOTE_TYPE_OPTIONS.map((option) => ({
      label: option.shortLabel,
      count: notes.filter((note) => note.note_type === option.id).length,
      value: option.id
    })).filter((item) => item.count > 0);

    const genres = topItems(countBy(notes.map((note) => clean(note.metadata?.genre))), 5);
    const keys = topItems(countBy(notes.map((note) => clean(note.metadata?.key))), 5);
    const moods = topItems(countBy(notes.map((note) => clean(note.metadata?.mood))), 5);
    const genreMoodPairs = topItems(countBy(notes.map((note) => {
      const genre = clean(note.metadata?.genre);
      const mood = clean(note.metadata?.mood);
      return genre && mood ? `${genre} + ${mood}` : '';
    })), 5);

    const allTags = notes.flatMap((note) => splitTags(note.metadata?.tags));
    const tags = topItems(countBy(allTags), 8);

    const bpmBuckets = BPM_BUCKETS.map((bucket) => ({
      label: bucket.label,
      count: notes.filter((note) => {
        const bpm = getBpmNumber(note.metadata?.bpm);
        return bpm != null && bpm >= bucket.min && bpm <= bucket.max;
      }).length,
      value: bucket.label
    }));

    const progressionSnippets = extractProgressionSnippets(notes, audioMarkers);

    return {
      typeCounts,
      genres,
      keys,
      moods,
      genreMoodPairs,
      tags,
      bpmBuckets,
      progressionSnippets,
      noteCount: notes.length,
      markerCount: audioMarkers.length,
      audioCount: audioFiles.length
    };
  }, [notes, audioFiles, audioMarkers]);

  return (
    <section className="music-dashboard">
      <button type="button" className="dashboard-toggle" onClick={() => setIsOpen((value) => !value)}>
        <span>
          <strong>Music Dashboard</strong>
          <em>라이브러리 통계와 데이터 탐색</em>
        </span>
        <b>{isOpen ? '접기' : '열기'}</b>
      </button>

      {isOpen && (
        <div className="dashboard-body">
          <div className="dashboard-overview-grid">
            <article>
              <strong>{stats.noteCount}</strong>
              <span>Total notes</span>
            </article>
            <article>
              <strong>{stats.markerCount}</strong>
              <span>Audio markers</span>
            </article>
            <article>
              <strong>{stats.audioCount}</strong>
              <span>MP3 files</span>
            </article>
            <article>
              <strong>{stats.progressionSnippets.length}</strong>
              <span>Chord sources</span>
            </article>
          </div>

          <div className="dashboard-grid">
            <div className="dashboard-card">
              <header>
                <strong>Type Usage</strong>
                <span>메모 타입별 개수</span>
              </header>
              <div className="mini-bar-list">
                {stats.typeCounts.length === 0 ? <p>No typed notes yet.</p> : stats.typeCounts.map((item) => {
                  const option = getNoteTypeOption(item.value);
                  return (
                    <button
                      type="button"
                      key={item.label}
                      onClick={() => onApplyFilters({}, item.value as NoteType)}
                    >
                      <span>{item.label}</span>
                      <i style={{ width: `${percent(item.count, stats.noteCount)}%`, background: option.color }} />
                      <em>{item.count}</em>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="dashboard-card">
              <header>
                <strong>BPM Distribution</strong>
                <span>템포 구간별 레퍼런스</span>
              </header>
              <div className="bpm-bucket-grid">
                {stats.bpmBuckets.map((bucket) => (
                  <button
                    key={bucket.label}
                    type="button"
                    onClick={() => {
                      const [min, max] = bucket.label === '146+' ? ['146', ''] : bucket.label.split('-');
                      onApplyFilters({ bpmMin: min, bpmMax: max });
                    }}
                  >
                    <strong>{bucket.label}</strong>
                    <span>{bucket.count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="dashboard-card">
              <header>
                <strong>Key Usage</strong>
                <span>자주 모은 Key</span>
              </header>
              <div className="chip-cloud">
                {stats.keys.length === 0 ? <p>No key data yet.</p> : stats.keys.map((item) => (
                  <button key={item.label} type="button" onClick={() => onApplyFilters({ key: item.label })}>
                    {item.label} <em>{item.count}</em>
                  </button>
                ))}
              </div>
            </div>

            <div className="dashboard-card">
              <header>
                <strong>Genre Top</strong>
                <span>장르별 데이터</span>
              </header>
              <div className="chip-cloud">
                {stats.genres.length === 0 ? <p>No genre data yet.</p> : stats.genres.map((item) => (
                  <button key={item.label} type="button" onClick={() => onApplyFilters({ genre: item.label })}>
                    {item.label} <em>{item.count}</em>
                  </button>
                ))}
              </div>
            </div>

            <div className="dashboard-card">
              <header>
                <strong>Genre / Mood Matrix</strong>
                <span>장르와 무드 조합</span>
              </header>
              <div className="chip-cloud">
                {stats.genreMoodPairs.length === 0 ? <p>No genre + mood pairs yet.</p> : stats.genreMoodPairs.map((item) => {
                  const [genre, mood] = item.label.split(' + ');
                  return (
                    <button key={item.label} type="button" onClick={() => onApplyFilters({ genre, mood })}>
                      {item.label} <em>{item.count}</em>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="dashboard-card">
              <header>
                <strong>Top Tags</strong>
                <span>자주 쓰는 분석 태그</span>
              </header>
              <div className="chip-cloud">
                {stats.tags.length === 0 ? <p>No tags yet.</p> : stats.tags.map((item) => (
                  <button key={item.label} type="button" onClick={() => onApplyFilters({ tag: item.label })}>
                    #{item.label} <em>{item.count}</em>
                  </button>
                ))}
              </div>
            </div>

            <div className="dashboard-card dashboard-card-wide">
              <header>
                <strong>Section Chord Progressions</strong>
                <span>마커/코드 메모에서 자주 나온 진행</span>
              </header>
              <div className="progression-list">
                {stats.progressionSnippets.length === 0 ? <p>No chord progressions yet.</p> : stats.progressionSnippets.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => onOpenChordTool(item.label)}
                  >
                    <span>{item.label}</span>
                    <em>{item.count}</em>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
