export type NoteType =
  | 'general'
  | 'song_analysis'
  | 'chord_progression'
  | 'rhythm_pattern'
  | 'sound_design'
  | 'lyrics_hook'
  | 'demo_idea';

export type MusicMetadata = {
  genre?: string;
  mood?: string;
  section?: string;
  harmony?: string;
  bpm?: string;
  key?: string;
  instrument?: string;
  confidence?: 'High' | 'Medium' | 'Low' | '';
  tags?: string;
  source?: string;
};

export const NOTE_TYPE_OPTIONS: Array<{
  id: NoteType;
  label: string;
  shortLabel: string;
  color: string;
  description: string;
}> = [
  { id: 'general', label: 'General Note', shortLabel: 'Note', color: '#8e8e93', description: '자유 메모 / 빠른 기록' },
  { id: 'song_analysis', label: 'Song Analysis', shortLabel: 'Analysis', color: '#7c5cff', description: '곡 구조, 코드, 리듬, 사운드 분석' },
  { id: 'chord_progression', label: 'Chord Progression', shortLabel: 'Chord', color: '#35c759', description: '코드 진행, 로만, 기능, 보이싱 저장' },
  { id: 'rhythm_pattern', label: 'Rhythm Pattern', shortLabel: 'Rhythm', color: '#ff9f0a', description: '드럼/그루브/스윙/리듬 패턴 저장' },
  { id: 'sound_design', label: 'Sound Design', shortLabel: 'Sound', color: '#32d2d2', description: '신스, 베이스, FX, 질감 레퍼런스' },
  { id: 'lyrics_hook', label: 'Lyrics / Hook Idea', shortLabel: 'Lyrics', color: '#ff5a8a', description: '가사, 훅, 반복 키워드, 콘셉트' },
  { id: 'demo_idea', label: 'My Demo Idea', shortLabel: 'Demo', color: '#4d9fff', description: '내 작업 아이디어와 발전 메모' }
];

export function getNoteTypeOption(type?: string | null) {
  return NOTE_TYPE_OPTIONS.find((option) => option.id === type) ?? NOTE_TYPE_OPTIONS[0];
}

export function defaultTitleForType(type: NoteType) {
  switch (type) {
    case 'song_analysis':
      return 'New Song Analysis';
    case 'chord_progression':
      return 'New Chord Progression';
    case 'rhythm_pattern':
      return 'New Rhythm Pattern';
    case 'sound_design':
      return 'New Sound Design';
    case 'lyrics_hook':
      return 'New Lyrics / Hook Idea';
    case 'demo_idea':
      return 'New Demo Idea';
    default:
      return 'Untitled';
  }
}

export function defaultMetadataForType(type: NoteType): MusicMetadata {
  switch (type) {
    case 'song_analysis':
      return { genre: 'K-pop', mood: '', section: 'Full Song', harmony: '', bpm: '', key: '', instrument: '', confidence: 'Medium', tags: 'song form, chord, rhythm', source: 'Manual analysis' };
    case 'chord_progression':
      return { genre: '', mood: '', section: 'Chorus', harmony: '', bpm: '', key: '', instrument: 'Keys', confidence: 'Medium', tags: 'chord progression, voicing', source: 'Manual input' };
    case 'rhythm_pattern':
      return { genre: '', mood: '', section: 'Groove', harmony: '', bpm: '', key: '', instrument: 'Drums', confidence: 'Medium', tags: 'drums, groove, rhythm', source: 'Manual input' };
    case 'sound_design':
      return { genre: '', mood: '', section: '', harmony: '', bpm: '', key: '', instrument: 'Synth', confidence: 'Medium', tags: 'sound design, preset', source: 'Manual input' };
    case 'lyrics_hook':
      return { genre: '', mood: '', section: 'Hook', harmony: '', bpm: '', key: '', instrument: 'Vocal', confidence: 'Medium', tags: 'lyrics, hook', source: 'Writing idea' };
    case 'demo_idea':
      return { genre: '', mood: '', section: '', harmony: '', bpm: '', key: '', instrument: '', confidence: 'Medium', tags: 'demo, idea', source: 'My idea' };
    default:
      return { confidence: '', tags: '' };
  }
}

function h2(value: string) {
  return `<h2>${value}</h2>`;
}

function p(value: string) {
  return `<p>${value}</p>`;
}

function ul(items: string[]) {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
}

export function templateContentForType(type: NoteType) {
  switch (type) {
    case 'song_analysis':
      return [
        h2('Basic Info'),
        p('Title: '),
        p('Artist: '),
        p('Genre / BPM / Key / Mood: '),
        h2('Song Form'),
        p('Intro:  / Verse:  / Pre-Chorus:  / Chorus:  / Hook:  / Bridge:  / Outro: '),
        h2('Chord Progression'),
        p('Section:  | Chords:  | Roman Numeral:  | Function: '),
        p('Modal Interchange / Secondary Dominant / Top Note / Voicing: '),
        h2('Rhythm / Groove'),
        p('Kick:  / Snare:  / Hat:  / Swing:  / Syncopation: '),
        h2('Arrangement'),
        p('Drums / Bass / Synth / Guitar / FX / Vocal Texture: '),
        h2('Mix / Sound'),
        p('Low / Mid / High / Space / Reference Mix: '),
        h2('Reusable Idea'),
        ul(['내 곡에 가져올 요소:', '그대로 쓰면 위험한 요소:', '변형 아이디어:']),
        h2('Source / Confidence'),
        p('Source: 직접 청취 분석 / 공식 자료 / 추정')
      ].join('');
    case 'chord_progression':
      return [
        h2('Chord Progression'),
        p('Key: '),
        p('Progression: '),
        p('Roman Numeral: '),
        p('Function: '),
        p('Top Note Chain: '),
        p('Voicing: '),
        p('Use Case: Verse / Pre-Chorus / Chorus / Bridge'),
        h2('Reusable Idea'),
        ul(['어울리는 장르:', '어울리는 무드:', '변형 아이디어:'])
      ].join('');
    case 'rhythm_pattern':
      return [
        h2('Rhythm Pattern'),
        p('BPM: '),
        p('Groove: '),
        p('Kick: '),
        p('Snare / Clap: '),
        p('Hi-hat: '),
        p('Swing / Syncopation: '),
        p('Bass Rhythm: '),
        h2('Reusable Idea'),
        ul(['어울리는 송폼:', '어울리는 장르:', '주의할 점:'])
      ].join('');
    case 'sound_design':
      return [
        h2('Sound Design'),
        p('Sound Name: '),
        p('Instrument: Synth / Bass / EP / Pad / FX / Vocal Chop'),
        p('Texture: bright / airy / gritty / warm / metallic'),
        p('Processing: EQ / Comp / Saturation / Reverb / Delay'),
        h2('Reusable Idea'),
        ul(['사용할 파트:', '비슷하게 만들 방법:', '주의할 점:'])
      ].join('');
    case 'lyrics_hook':
      return [
        h2('Lyrics / Hook Idea'),
        p('Keyword: '),
        p('Mood: '),
        p('Target: Boy Group / Girl Group / Solo'),
        h2('Hook Draft'),
        p(''),
        h2('Variations'),
        ul(['반복 키워드:', 'Chant idea:', 'English/Korean mix idea:'])
      ].join('');
    case 'demo_idea':
      return [
        h2('My Demo Idea'),
        p('Concept: '),
        p('BPM / Key / Genre: '),
        p('Main Hook: '),
        p('Chord Progression: '),
        p('Rhythm: '),
        p('Sound Palette: '),
        h2('Next Action'),
        ul(['오늘 할 작업:', '보완할 점:', '피칭 타깃:'])
      ].join('');
    default:
      return '<p>Start writing...</p>';
  }
}
