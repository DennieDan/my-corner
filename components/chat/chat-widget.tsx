"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowUp, BookOpen, MessageCircle, RotateCcw, Square, Trash2, X } from "lucide-react";

import {
  boundedHistory, chatEndpoint, MAX_MESSAGE_LENGTH, safeSource, streamChat,
  type ChatSource, type HistoryMessage,
} from "@/lib/chat/client";

interface Message extends HistoryMessage {
  id: string;
  sources?: ChatSource[];
}

const HISTORY_KEY = "dennie:history:v2";
const SESSION_KEY = "dennie:session:v2";
const HISTORY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
const QUESTIONS = [
  "What projects has Dan worked on?",
  "What is Dan's background?",
  "What skills does Dan use?",
];
const endpoint = chatEndpoint(process.env.NEXT_PUBLIC_AGENT_API_URL ?? "");

function loadHistory(): Message[] {
  try {
    // The previous format had no timestamp, so its age cannot be verified.
    localStorage.removeItem("dennie:history:v1");
    localStorage.removeItem("dennie:session:v1");
    const stored: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "null");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return [];
    const { savedAt, messages } = stored as { savedAt?: unknown; messages?: unknown };
    if (typeof savedAt !== "number" || !Number.isFinite(savedAt) ||
        savedAt > Date.now() || Date.now() - savedAt >= HISTORY_MAX_AGE_MS || !Array.isArray(messages)) {
      localStorage.removeItem(HISTORY_KEY);
      localStorage.removeItem(SESSION_KEY);
      return [];
    }
    const items: Message[] = messages.flatMap((item) => {
      if (!item || typeof item !== "object" ||
          (item.role !== "user" && item.role !== "assistant") ||
          typeof item.content !== "string" || !item.content.trim() || item.content.length > 4_000) return [];
      return [{
        id: crypto.randomUUID(), role: item.role, content: item.content,
        sources: Array.isArray(item.sources) ? (item.sources as unknown[]).map(safeSource).filter((source): source is ChatSource => !!source).slice(0, 12) : [],
      }];
    });
    return boundMessages(items);
  } catch { return []; }
}

function boundMessages(items: Message[]): Message[] {
  const result: Message[] = [];
  let characters = 0;
  for (const item of items.slice().reverse()) {
    if (!item.content.trim() || item.content.length > 4_000) continue;
    if (result.length >= 12 || characters + item.content.length > 12_000) break;
    result.unshift(item);
    characters += item.content.length;
  }
  return result;
}

function sessionId(): string {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored && /^[0-9a-f-]{36}$/i.test(stored)) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch { return crypto.randomUUID(); }
}

function CitationText({ text, sources }: { text: string; sources: ChatSource[] }) {
  const byId = new Map(sources.map((source) => [source.id, source]));
  return <span className="whitespace-pre-wrap break-words">{text.split(/(\[S\d+(?:,\s*S\d+)*\])/g).map((part, index) => {
    const labels = /^\[(S\d+(?:,\s*S\d+)*)\]$/.exec(part)?.[1].split(/,\s*/);
    if (!labels) return <span key={index}>{part}</span>;
    return <span key={index} className="inline-flex flex-wrap gap-1">{labels.map((label) => {
      const source = byId.get(label);
      return source ? <a key={label} href={source.url} target="_blank" rel="noopener noreferrer"
        className="rounded-sm font-semibold text-[#315d50] underline underline-offset-2 hover:text-[#173e32] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315d50]"
        aria-label={`Source ${label}: ${source.title} (opens in a new tab)`}>[{label}]</a> : <span key={label}>[{label}]</span>;
    })}</span>;
  })}</span>;
}

function SourceList({ text, sources }: { text: string; sources: ChatSource[] }) {
  const cited = new Set([...text.matchAll(/\[(S\d+(?:,\s*S\d+)*)\]/g)].flatMap((match) => match[1].split(/,\s*/)));
  const visible = sources.filter((source) => cited.has(source.id));
  if (!visible.length) return null;
  return <div className="mt-3 border-t border-[#7a9e8e]/20 pt-2">
    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#536b61]"><BookOpen size={13} aria-hidden />Sources</p>
    <ul className="space-y-1">{visible.map((source) => <li key={source.id}>
      <a href={source.url} target="_blank" rel="noopener noreferrer"
        className="text-xs text-[#315d50] underline underline-offset-2 hover:text-[#173e32] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315d50]">
        [{source.id}] {source.title} <span className="sr-only">(opens in a new tab)</span>
      </a>
    </li>)}</ul>
  </div>;
}

export function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState("");
  const [partial, setPartial] = useState("");
  const [sources, setSources] = useState<ChatSource[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const requestRef = useRef(0);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousPath = useRef(pathname);

  useEffect(() => { setMessages(loadHistory()); sessionId(); setReady(true); }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      if (messages.length) {
        const existing: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "null");
        const prior = existing && typeof existing === "object" && !Array.isArray(existing)
          ? (existing as { savedAt?: unknown }).savedAt : undefined;
        const savedAt = typeof prior === "number" && Number.isFinite(prior) && prior <= Date.now() &&
          Date.now() - prior < HISTORY_MAX_AGE_MS ? prior : Date.now();
        localStorage.setItem(HISTORY_KEY, JSON.stringify({
          savedAt,
          messages: boundMessages(messages).map(({ role, content, sources }) => ({ role, content, sources })),
        }));
      } else localStorage.removeItem(HISTORY_KEY);
    } catch { /* browsing without storage still works */ }
  }, [messages, ready]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages, partial, pending, open]);
  const stop = useCallback(() => {
    requestRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      try {
        const stored: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "null");
        const savedAt = stored && typeof stored === "object" && !Array.isArray(stored)
          ? (stored as { savedAt?: unknown }).savedAt : undefined;
        if (typeof savedAt === "number" && Date.now() - savedAt >= HISTORY_MAX_AGE_MS) {
          stop();
          localStorage.removeItem(HISTORY_KEY);
          localStorage.removeItem(SESSION_KEY);
          setMessages([]);
          setPending(""); setPartial(""); setSources([]);
          setNotice("Conversation expired after seven days.");
        }
      } catch { /* browsing without storage still works */ }
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [stop]);

  useEffect(() => {
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      stop();
      setPending(""); setPartial(""); setSources([]); setError("");
    }
  }, [pathname, stop]);
  useEffect(() => {
    window.addEventListener("pagehide", stop);
    return () => { window.removeEventListener("pagehide", stop); stop(); };
  }, [stop]);

  function close() {
    setOpen(false);
    launcherRef.current?.focus();
  }

  function clear() {
    stop();
    setMessages([]); setPending(""); setPartial(""); setSources([]); setError(""); setDraft("");
    setNotice("Conversation cleared.");
    try { localStorage.removeItem(HISTORY_KEY); localStorage.removeItem(SESSION_KEY); } catch { /* no storage */ }
    sessionId();
    inputRef.current?.focus();
  }

  async function send(question: string) {
    const message = question.trim();
    if (!message || message.length > MAX_MESSAGE_LENGTH || busy) return;
    const api = endpoint;
    setDraft(""); setPending(message); setPartial(""); setSources([]); setError(""); setNotice("");
    if (!api) { setError("Chat is not configured yet. Please try again later."); return; }
    const controller = new AbortController();
    abortRef.current = controller;
    const request = ++requestRef.current;
    setBusy(true);
    let answer = "";
    let receivedSources: ChatSource[] = [];
    try {
      await streamChat(api, { message, history: boundedHistory(messages), sessionId: sessionId() }, controller.signal, (event) => {
        if (request !== requestRef.current) return;
        if (event.type === "sources") { receivedSources = event.sources; setSources(event.sources); }
        if (event.type === "delta") { answer += event.text; setPartial(answer); }
      });
      if (request !== requestRef.current) return;
      const exchange: Message[] = [
        { id: crypto.randomUUID(), role: "user", content: message },
        { id: crypto.randomUUID(), role: "assistant", content: answer, sources: receivedSources },
      ];
      setMessages((current) => boundMessages([...current, ...exchange]));
      setPending(""); setPartial(""); setSources([]);
      setNotice("Dennie finished responding.");
    } catch (failure) {
      if (request !== requestRef.current || controller.signal.aborted) return;
      setPartial(""); setSources([]);
      setError(failure instanceof Error ? failure.message : "Dennie is temporarily unavailable. Please try again.");
      setNotice("Dennie could not finish the answer.");
    } finally {
      if (request === requestRef.current) { setBusy(false); abortRef.current = null; }
    }
  }

  function cancel() {
    stop(); setPartial(""); setSources([]); setError(""); setNotice("Response stopped. You can retry or ask another question.");
  }

  return <div className="fixed bottom-4 right-4 z-[60] sm:bottom-6 sm:right-6">
    {open && <section id="dennie-chat-panel" role="dialog" aria-modal="false" aria-labelledby="dennie-title"
      onKeyDown={(event) => { if (event.key === "Escape") close(); }}
      className="mb-3 flex h-[min(680px,calc(100dvh-6.5rem))] w-[calc(100vw-2rem)] max-w-[420px] flex-col overflow-hidden rounded-2xl border border-[#7a9e8e]/30 bg-[#faf9f5] shadow-[0_16px_50px_rgba(42,69,57,0.24)] sm:mb-4">
      <header className="flex items-center gap-3 border-b border-[#7a9e8e]/20 bg-[#e2ece7] px-4 py-3 text-[#344e42]">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#6f9582] text-white"><MessageCircle size={20} aria-hidden /></div>
        <div className="min-w-0 flex-1"><h2 id="dennie-title" className="font-serif text-lg font-semibold">Dennie</h2><p className="text-xs text-[#536b61]">Ask about Dan Dinh</p></div>
        <button type="button" onClick={clear} disabled={!messages.length && !pending} aria-label="Clear conversation"
          className="rounded-lg p-2 hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-[#315d50] disabled:opacity-40"><Trash2 size={18} aria-hidden /></button>
        <button type="button" onClick={close} aria-label="Close chat"
          className="rounded-lg p-2 hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-[#315d50]"><X size={19} aria-hidden /></button>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5" aria-label="Conversation">
        <div className="mr-8 rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm leading-relaxed text-[#344e42] shadow-sm">
          Hi, I&apos;m Dennie. Ask me about Dan&apos;s background, work, or projects. I answer from approved public sources and may not know everything.
        </div>
        {!messages.length && !pending && <div className="space-y-2" aria-label="Suggested questions">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#536b61]">Try asking</p>
          {QUESTIONS.map((question) => <button key={question} type="button" onClick={() => void send(question)}
            className="block w-full rounded-xl border border-[#7a9e8e]/35 bg-white px-3 py-2.5 text-left text-sm text-[#315d50] hover:bg-[#edf3ee] focus-visible:outline-2 focus-visible:outline-[#315d50]">{question}</button>)}
        </div>}
        {messages.map((item) => <div key={item.id} className={item.role === "user" ? "ml-8 rounded-2xl rounded-tr-sm bg-[#6f9582] px-4 py-3 text-sm leading-relaxed text-white" : "mr-8 rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm leading-relaxed text-[#344e42] shadow-sm"}>
          {item.role === "assistant" ? <><CitationText text={item.content} sources={item.sources ?? []} /><SourceList text={item.content} sources={item.sources ?? []} /></> : <span className="whitespace-pre-wrap break-words">{item.content}</span>}
        </div>)}
        {pending && <div className="ml-8 rounded-2xl rounded-tr-sm bg-[#6f9582] px-4 py-3 text-sm leading-relaxed text-white whitespace-pre-wrap break-words">{pending}</div>}
        {busy && <div className="mr-8 rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm leading-relaxed text-[#344e42] shadow-sm">
          {partial ? <><CitationText text={partial} sources={sources} /><span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-[#6f9582] motion-reduce:animate-none" aria-hidden /><SourceList text={partial} sources={sources} /></> : <span className="text-[#536b61]">Dennie is thinking…</span>}
        </div>}
        {pending && !busy && !error && <div className="mr-8 rounded-xl border border-[#7a9e8e]/30 bg-white p-3 text-sm text-[#536b61]">
          <p>Response stopped.</p><button type="button" onClick={() => void send(pending)} className="mt-2 inline-flex items-center gap-1 font-semibold text-[#315d50] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-[#315d50]"><RotateCcw size={14} aria-hidden /> Retry</button>
        </div>}
        {error && <div role="alert" className="rounded-xl border border-[#b98475]/30 bg-[#fff2ed] p-3 text-sm text-[#7b3e35]">
          <p>{error}</p><button type="button" onClick={() => void send(pending)} className="mt-2 inline-flex items-center gap-1 font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-[#7b3e35]"><RotateCcw size={14} aria-hidden /> Retry</button>
        </div>}
      </div>

      <p role="status" aria-live="polite" className="sr-only">{notice}</p>
      <footer className="border-t border-[#7a9e8e]/20 bg-white/80 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <form onSubmit={(event) => { event.preventDefault(); void send(draft); }} className="flex items-end gap-2">
          <label htmlFor="dennie-message" className="sr-only">Message Dennie</label>
          <textarea id="dennie-message" ref={inputRef} rows={2} maxLength={MAX_MESSAGE_LENGTH} value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(draft); } }}
            placeholder="Ask about Dan…" disabled={busy}
            className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-[#7a9e8e]/35 bg-white px-3 py-2.5 text-sm text-[#344e42] placeholder:text-[#63766c] focus-visible:outline-2 focus-visible:outline-[#315d50] disabled:opacity-60" />
          {busy ? <button type="button" onClick={cancel} aria-label="Stop response" title="Stop response"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#6f9582] text-white hover:bg-[#557b67] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315d50]"><Square size={16} fill="currentColor" aria-hidden /></button> :
            <button type="submit" disabled={!draft.trim()} aria-label="Send message" title="Send message"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#6f9582] text-white hover:bg-[#557b67] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315d50] disabled:opacity-40"><ArrowUp size={20} aria-hidden /></button>}
        </form>
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] leading-tight text-[#536b61]"><span>Answers may be inaccurate. Avoid private details.</span><Link href="/dennie" className="shrink-0 font-semibold underline underline-offset-2 hover:text-[#315d50] focus-visible:outline-2 focus-visible:outline-[#315d50]">About Dennie</Link></div>
      </footer>
    </section>}
    <button ref={launcherRef} type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="dennie-chat-panel"
      className="ml-auto flex min-h-12 items-center gap-2 rounded-full bg-[#527b68] px-5 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.03] hover:bg-[#416a56] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315d50] motion-reduce:transition-none motion-reduce:hover:scale-100">
      <MessageCircle size={19} aria-hidden />{open ? "Close Dennie" : "Chat with Dennie"}
    </button>
  </div>;
}
