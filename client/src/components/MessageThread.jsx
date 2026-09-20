import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as teams from '../services/teamService';
export default function MessageThread({ teamId, onDenied }) {
  const [messages, setMessages] = useState([]), [cursor, setCursor] = useState(null), [content, setContent] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(false), loading = useRef(false), initialized = useRef(false), latestId = useRef(null), thread = useRef(null), scroll = useRef(null);
  const merge = (list, prepend = false) => {
    const el = thread.current;
    if (el) scroll.current = { top: el.scrollTop, height: el.scrollHeight, prepend, stick: el.scrollHeight - el.scrollTop - el.clientHeight < 40 };
    setMessages(previous => [...new Map([...previous, ...list].map(m => [m._id, m])).values()].sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt) || a._id.localeCompare(b._id)));
  };
  useLayoutEffect(() => {
    const el = thread.current, position = scroll.current;
    if (el && position) el.scrollTop = position.prepend ? position.top + el.scrollHeight - position.height : position.stick ? el.scrollHeight : position.top;
    scroll.current = null;
  }, [messages]);
  const failure = e => { if (!alive.current) return; if ([403, 404].includes(e.response?.status)) { alive.current = false; onDenied(); } else setError(e.response?.data?.message || 'Messages could not refresh. Retrying shortly.'); };
  async function refresh() {
    if (!alive.current || loading.current) return;
    loading.current = true;
    try {
      const { data } = await teams.getMessages(teamId);
      const incoming = [...data.messages];
      let next = data.nextCursor;
      // Catch up after a busy interval without leaving a gap between loaded history and new messages.
      while (alive.current && latestId.current && !incoming.some(m => m._id === latestId.current) && next) {
        const older = await teams.getMessages(teamId, next);
        incoming.unshift(...older.data.messages); next = older.data.nextCursor;
      }
      if (alive.current) { merge(incoming); latestId.current = data.messages.at(-1)?._id || latestId.current; if (!initialized.current) { setCursor(data.nextCursor); initialized.current = true; } setError(''); }
    } catch (e) { failure(e); } finally { loading.current = false; }
  }
  useEffect(() => {
    alive.current = true; initialized.current = false; latestId.current = null; setMessages([]); refresh();
    const timer = setInterval(refresh, 12000);
    return () => { alive.current = false; clearInterval(timer); };
  }, [teamId]);
  async function older() {
    setBusy(true);
    try { const { data } = await teams.getMessages(teamId, cursor); if (alive.current) { merge(data.messages, true); setCursor(data.nextCursor); } } catch (e) { failure(e); } finally { if (alive.current) setBusy(false); }
  }
  async function send(e) {
    e.preventDefault(); setBusy(true);
    try { await teams.sendMessage(teamId, content); if (alive.current) { setContent(''); await refresh(); } } catch (e) { failure(e); } finally { if (alive.current) setBusy(false); }
  }
  return <section className="space-y-4"><p className="text-stone-600">Team conversation · refreshes every 12 seconds</p>{error && <p role="alert" className="text-red-700">{error}</p>}{cursor && <button disabled={busy} className="underline text-brand-800" onClick={older}>Load older messages</button>}<div ref={thread} className="max-h-[28rem] overflow-y-auto space-y-3 border rounded-2xl p-4" aria-label="Team messages">{messages.map(m => <article key={m._id} className="bg-brand-50 rounded-xl p-3"><div className="flex flex-wrap justify-between gap-2"><strong>{m.sender?.name || 'Member'}</strong><time className="text-xs text-stone-500">{new Date(m.sentAt).toLocaleString()}</time></div><p className="whitespace-pre-wrap break-words mt-1">{m.content}</p></article>)}{!messages.length && <p>No messages yet. Start the conversation.</p>}</div><form onSubmit={send} className="space-y-2"><label className="block">Message<textarea required maxLength={4000} className="block w-full border rounded-xl p-3" value={content} onChange={e => setContent(e.target.value)} /></label><button disabled={busy || !content.trim()} className="bg-brand-600 text-white rounded-xl px-5 py-3">Send message</button></form></section>;
}
