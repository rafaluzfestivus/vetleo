function safeNext(next) {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) {
    return '/';
  }
  return next;
}

export default async function LoginPage({ searchParams }) {
  const params = (await searchParams) ?? {};
  const error = params.error;
  const next = safeNext(params.next);

  return (
    <main className="login-main">
      <form method="POST" action="/api/login" className="card login-card">
        <h1>🐾 Léo</h1>
        <p className="subtitle">Digite a senha para acessar o painel.</p>
        <input type="hidden" name="next" value={next} />
        <input type="password" name="password" placeholder="Senha" autoFocus required />
        <button type="submit">Entrar</button>
        {error && <p className="login-error">Senha incorreta.</p>}
      </form>
    </main>
  );
}
