import { FormEvent, useState } from 'react';
import { supabase } from '../lib/supabase';

type AuthProps = {
  onDemoMode?: () => void;
};

export default function Auth({ onDemoMode }: AuthProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin
      }
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage('로그인 링크를 이메일로 보냈어요. 메일함에서 링크를 눌러주세요.');
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

        <form onSubmit={handleLogin} className="auth-form">
          <label htmlFor="email">Email Login</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? '보내는 중...' : '로그인 링크 받기'}
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
