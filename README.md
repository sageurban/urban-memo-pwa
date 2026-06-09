# Urban Memo PWA

Mac과 iPhone에서 함께 쓰는 개인용 온라인 메모장 스타터 프로젝트입니다.

- React + Vite + TypeScript
- Supabase Auth + Postgres
- PWA 설치 지원
- 메모 작성 / 수정 / 삭제 / 검색 / 고정
- 자동 저장

---

## 1. Supabase 세팅

1. Supabase에서 새 프로젝트를 만듭니다.
2. `supabase/schema.sql` 파일 내용을 복사합니다.
3. Supabase Dashboard > SQL Editor에 붙여넣고 실행합니다.
4. Project Settings > API에서 아래 2개를 복사합니다.
   - Project URL
   - anon public key

---

## 2. 환경변수 세팅

`.env.example` 파일을 복사해서 `.env` 파일을 만듭니다.

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

`.env` 파일은 GitHub에 올리면 안 됩니다. 이미 `.gitignore`에 포함되어 있습니다.

---

## 3. 온라인에서 실행하기

### StackBlitz

1. StackBlitz에서 새 Vite React TypeScript 프로젝트를 만듭니다.
2. 이 프로젝트 파일을 그대로 업로드하거나 GitHub 저장소를 연결합니다.
3. `.env` 값을 입력합니다.
4. Preview에서 실행합니다.

### GitHub Codespaces

```bash
npm install
npm run dev
```

---

## 4. Vercel 배포

1. GitHub에 프로젝트를 업로드합니다.
2. Vercel에서 New Project를 선택합니다.
3. 해당 GitHub 저장소를 연결합니다.
4. Environment Variables에 아래 2개를 추가합니다.
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy를 누릅니다.

---

## 5. iPhone에서 앱처럼 쓰기

1. iPhone Safari에서 배포된 Vercel 주소로 접속합니다.
2. 공유 버튼을 누릅니다.
3. 홈 화면에 추가를 선택합니다.
4. Urban Memo 아이콘으로 실행합니다.

---

## 6. 다음 확장 추천

- Lyrics / Chord / Mix / Todo 카테고리
- 휴지통 복구
- Markdown 미리보기
- 태그
- 다크/라이트 테마 전환
- 로컬 오프라인 임시 저장
