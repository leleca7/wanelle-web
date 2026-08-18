'use client';

import { FormEvent, useState } from 'react';
import { neon } from '@/lib/neon';

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'signup') {
        await neon.auth.signUp.email({ email, password, name });
      } else {
        await neon.auth.signIn.email({ email, password });
      }

      const session = await neon.auth.getSession();
      if (!session.data) {
        throw new Error('Não foi possível iniciar a sessão. Verifique os dados e tente novamente.');
      }
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.');
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand">
          <img src="/wanelle-logo.png" alt="Wanelle Tortas" />
        </div>
        <p className="eyebrow">Sistema de gestão</p>
        <h1>{mode === 'signin' ? 'Bem-vinda de volta.' : 'Criar acesso Wanelle'}</h1>
        <p className="muted">Pedidos, agenda, estoque e financeiro em um só lugar.</p>

        <form onSubmit={submit} className="login-form">
          {mode === 'signup' && (
            <label>
              Nome
              <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Seu nome" />
            </label>
          )}
          <label>
            E-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="voce@exemplo.com" />
          </label>
          <label>
            Senha
            <input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Mínimo de 8 caracteres" />
          </label>

          {error && <div className="error-box">{error}</div>}
          <button className="button primary wide" disabled={loading} type="submit">
            {loading ? 'Aguarde…' : mode === 'signin' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <button className="text-button" type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}>
          {mode === 'signin' ? 'Primeiro acesso? Criar conta' : 'Já possui conta? Entrar'}
        </button>
      </section>
    </main>
  );
}
