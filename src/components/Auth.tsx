import { FormEvent, useState } from 'react';
import { supabase } from '../lib/supabase';

type AuthProps = {
  onDemoMode?: () => void;
};

type AuthMode = 'login' | 'signup';

export default function Auth({ onDemoMode }: AuthProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    if (password.length < 6) {
      setMessage('비밀번호는 최소 6자 이상으로 입력해주세요.');
      setLoading(false);
      return;
    }

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage('로그인되었습니다.');
      }
    }

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin
        }
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage(
          '회원가입이 완료되었습니다. Supabase 설정에 따라 이메일 확인이 필요할 수 있습니다.'
        );
      }
    }

    setLoading(false);
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="logo-mark">UM</div>
        <h1>Urban Memo</h1>
        <p className="muted">
          Mac과 iPhone에서 함께 쓰는 개인용 동기화 메모장입니다.
        </p>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => {
              setMode('login');
              setMessage('');
            }}
          >
            로그인
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => {
              setMode('signup');
              setMessage('');
            }}
          >
            회원가입
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="최소 6자 이상"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
          />

          <button type="submit" disabled={loading}>
            {loading
              ? '처리 중...'
              : mode === 'login'
                ? '이메일로 로그인'
                : '이메일로 회원가입'}
          </button>
        </form>

        {message && <p className="notice">{message}</p>}

        {onDemoMode && (
          <button className="ghost-button" type="button" onClick={onDemoMode}>
            Supabase 연결 전 UI만 보기
          </button>
        )}
      </section>
    </main>
  );
}