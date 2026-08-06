'use client';

import { useRef, useState } from 'react';

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim() && !file) return;

    const displayText = input.trim() || (file ? `[Arquivo anexado: ${file.name}]` : '');
    const userMessage = { role: 'user', text: displayText, fileName: file?.name };
    const priorHistory = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, userMessage]);
    setSending(true);

    const formData = new FormData();
    formData.append('message', input);
    formData.append('history', JSON.stringify(priorHistory));
    if (file) formData.append('file', file);

    setInput('');
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    try {
      const res = await fetch('/api/chat', { method: 'POST', body: formData });
      const data = await res.json();
      const replyText = res.ok ? data.reply : `Erro: ${data.error ?? 'falha desconhecida'}`;
      setMessages((prev) => [...prev, { role: 'assistant', text: replyText }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', text: `Erro de rede: ${err.message}` }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="chat-main">
      <div className="chat-header">
        <h1>🐾 Chat do Léo</h1>
        <a href="/">Painel</a>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <p className="empty">Pergunte sobre o Léo, ou anexe um documento (foto/PDF) pra cadastrar.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble chat-${m.role}`}>
            {m.fileName && <div className="chat-file">📎 {m.fileName}</div>}
            <div>{m.text}</div>
          </div>
        ))}
        {sending && <div className="chat-bubble chat-assistant chat-pending">Pensando…</div>}
      </div>

      <form className="chat-form" onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte ou descreva o que quer cadastrar..."
          rows={2}
        />
        <div className="chat-form-row">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            accept="image/*,application/pdf"
          />
          <button type="submit" disabled={sending}>
            Enviar
          </button>
        </div>
      </form>
    </main>
  );
}
