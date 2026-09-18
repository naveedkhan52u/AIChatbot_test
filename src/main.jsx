import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bot, Mic, Send, Sparkles, UserRound, Volume2, Square, Copy, Check, Code2, X } from 'lucide-react';
import { getSupabase } from './lib/supabase';
import AdminApp from './AdminApp';
import SuperAdminBusinesses from './SuperAdminBusinesses';
import './styles.css';


function ChatbotApp({ embedded = false }) {
  const params = new URLSearchParams(window.location.search);
  const businessId = params.get('businessId');
  const businessSlug = params.get('businessSlug');
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'Hello! I’m your AI customer support assistant. Ask me about our services, prices, opening hours, or bookings.' }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [leadOpen, setLeadOpen] = useState(false); const [leadForm, setLeadForm] = useState({ name: '', email: '', contact: '', subject: '' }); const [leadSending, setLeadSending] = useState(false); const [leadNotice, setLeadNotice] = useState('');
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [speakingIndex, setSpeakingIndex] = useState(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    async function loadSuggestions() {
      try {
        const query = new URLSearchParams();
        if (businessId) query.set('businessId', businessId);
        else if (businessSlug) query.set('businessSlug', businessSlug);
        else return;

        const response = await fetch(`/api/suggestions?${query.toString()}`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store'
        });
        if (!response.ok) return;

        const data = await response.json();
        if (mounted) setSuggestions(Array.isArray(data.suggestions) ? data.suggestions.slice(0, 3) : []);
      } catch (error) {
        console.error('Unable to load FAQ suggestions:', error);
      }
    }

    loadSuggestions();
    return () => { mounted = false; };
  }, [businessId, businessSlug]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = document.documentElement.lang || 'en-US';
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = event => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) transcript += event.results[i][0].transcript;
      setInput(transcript);
    };
    recognitionRef.current = recognition;
    return () => { recognition.stop(); recognitionRef.current = null; };
  }, []);

  function toggleListening() {
    if (!speechSupported) {
      setMessages(current => [...current, { role: 'assistant', text: 'Voice input is not supported by this browser. Please use Chrome or Edge, or type your question.' }]);
      return;
    }
    if (listening) { recognitionRef.current?.stop(); return; }
    try { recognitionRef.current?.start(); } catch (error) { console.error(error); }
  }

  function readResponse(text, index) {
    if (!('speechSynthesis' in window)) {
      setMessages(current => [...current, { role: 'assistant', text: 'Voice playback is not supported by this browser.' }]);
      return;
    }
    window.speechSynthesis.cancel();
    if (speakingIndex === index) { setSpeakingIndex(null); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US'; utterance.rate = 1;
    utterance.onstart = () => setSpeakingIndex(index);
    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);
    setSpeakingIndex(index); window.speechSynthesis.speak(utterance);
  }

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  async function sendMessage(text = input) {
    const value = text.trim();
    if (!value || loading) return;
    if (listening) recognitionRef.current?.stop();
    setMessages(current => [...current, { role: 'user', text: value }]);
    setInput(''); setLoading(true);
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: value, businessId, businessSlug }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Request failed');
      setMessages(current => [...current, { role: 'assistant', text: data.answer, irrelevant: Boolean(data.irrelevant) }]);
      if (data.irrelevant) { setLeadOpen(true); setLeadNotice(''); }
    } catch (error) {
      setMessages(current => [...current, { role: 'assistant', text: 'I’m unable to connect to the support service right now. Please try again shortly.' }]);
      console.error(error);
    } finally { setLoading(false); }
  }

  async function submitLead(event) {
    event.preventDefault();
    if (leadSending) return;
    setLeadSending(true); setLeadNotice('');
    try {
      const response = await fetch('/api/contact-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ ...leadForm, businessId, businessSlug })
      });
      const raw = await response.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = { error: raw.replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim().slice(0, 220) || 'The server returned an unexpected response.' }; }
      if (!response.ok) throw new Error(data.error || 'Could not send your details.');
      setLeadForm({ name: '', email: '', contact: '', subject: '' });
      setLeadOpen(false);
      setLeadNotice('Thank you. Your details were sent to this business.');
    } catch (error) {
      setLeadNotice(error.message || 'Could not send your details.');
    } finally { setLeadSending(false); }
  }

  return <main className={`app-shell${embedded ? ' embedded-shell' : ''}`}><section className="chat-card">
    <header className="chat-header"><div className="brand-icon"><Bot size={24} /></div><div><h1>AI Customer Support</h1><p><span className="status-dot" /> Online assistant</p></div>{!embedded && <button className="admin-link" onClick={() => { window.location.href = '/admin'; }}>Admin</button>}</header>
    <div className="chat-body"><div className="welcome"><div className="welcome-icon"><Sparkles size={22} /></div><div><h2>How can I help?</h2><p>Ask a question or choose one of the common questions below.</p></div></div>
      <div className="messages">{messages.map((message, index) => <div key={index} className={`message-row ${message.role}`}><div className="avatar">{message.role === 'assistant' ? <Bot size={17} /> : <UserRound size={17} />}</div><div className="bubble-wrap">{message.role === 'assistant' && <button className={`read-button${speakingIndex === index ? ' active' : ''}`} onClick={() => readResponse(message.text, index)} aria-label={speakingIndex === index ? 'Stop reading response' : 'Read response aloud'}>{speakingIndex === index ? <Square size={11} /> : <Volume2 size={12} />}<span>{speakingIndex === index ? 'Stop' : 'Read'}</span></button>}<div className={`bubble${message.irrelevant ? " irrelevant-bubble" : ""}`}>{message.text}</div></div></div>)}{loading && <div className="message-row assistant"><div className="avatar"><Bot size={17} /></div><div className="bubble typing">Thinking...</div></div>}</div>
      <div className="suggestions">{suggestions.map(item => <button key={item} onClick={() => sendMessage(item)} disabled={loading}>{item}</button>)}</div>
      {leadOpen && <form className="lead-form" onSubmit={submitLead}>
        <div className="lead-warning">⚠️ <strong>I can only assist with this business and its services.</strong></div>
        <div className="lead-form-title">Please leave your details and we will contact you.</div>
        <input value={leadForm.name} onChange={e => setLeadForm({ ...leadForm, name: e.target.value })} placeholder="Name" required />
        <input type="email" value={leadForm.email} onChange={e => setLeadForm({ ...leadForm, email: e.target.value })} placeholder="Email" required />
        <input value={leadForm.contact} onChange={e => setLeadForm({ ...leadForm, contact: e.target.value })} placeholder="Contact / WhatsApp Number" required />
        <input value={leadForm.subject} onChange={e => setLeadForm({ ...leadForm, subject: e.target.value })} placeholder="Subject" required />
        <div className="lead-form-actions"><button type="button" className="lead-close-btn" onClick={() => { setLeadOpen(false); setLeadNotice(''); }}>Close</button><button type="submit" disabled={leadSending}>{leadSending ? 'Sending...' : 'Send Details'}</button></div>
      </form>}
      {leadNotice && <div className="lead-notice">{leadNotice}</div>}
    </div>
    <footer className="composer"><button className={`mic-button${listening ? ' listening' : ''}`} onClick={toggleListening} disabled={loading} aria-label={listening ? 'Stop listening' : 'Speak your question'} title={speechSupported ? (listening ? 'Stop listening' : 'Speak') : 'Voice input is not supported'}><Mic size={18} /></button><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder={listening ? 'Listening...' : 'Type or speak your question...'} aria-label="Type or speak your question" disabled={loading} /><button className="send-button" onClick={() => sendMessage()} disabled={loading} aria-label="Send message"><Send size={19} /></button></footer>
    <div className="footer-note">Powered by AI • Your conversation is handled securely</div>
  </section></main>;
}

function EmbedCodePanel() {
  const [businessId, setBusinessId] = useState(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadBusinessId() {
      try {
        const supabase = getSupabase();
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) return;
        const { data, error } = await supabase.from('business_admins').select('business_id').eq('user_id', userId).maybeSingle();
        if (error) throw error;
        if (mounted) setBusinessId(data?.business_id || null);
      } catch (error) {
        console.error('Unable to load business ID for embed code:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadBusinessId();
    return () => { mounted = false; };
  }, []);

  if (loading || !businessId) return null;

  const embedCode = `<script src="https://ai-chatbot-test-nine-iota.vercel.app/chatbot.js" data-business-id="${businessId}" defer></script>`;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.error('Could not copy embed code:', error);
    }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="Get chatbot embed code" style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 1000, display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #c7e3f7', borderRadius: 9, padding: '8px 11px', background: '#eef8ff', color: '#4aa3df', fontWeight: 600, fontSize: 13, cursor: 'pointer', boxShadow: '0 6px 18px rgba(74,163,223,.14)' }}><Code2 size={17} /> Embed Chatbot</button>
    {open && <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(15,23,42,.45)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <section onClick={event => event.stopPropagation()} style={{ width: 'min(680px, 100%)', background: '#fff', borderRadius: 18, padding: 24, boxShadow: '0 24px 80px rgba(0,0,0,.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div><div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 20 }}><Code2 size={20} /> Embed your AI chatbot</div><p style={{ margin: '8px 0 0', color: '#64748b', lineHeight: 1.5 }}>Copy this code and paste it before the closing <code>&lt;/body&gt;</code> tag on the owner’s website.</p></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ border: 0, background: '#f1f5f9', borderRadius: 8, width: 34, height: 34, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ marginTop: 20, padding: 16, background: '#0f172a', borderRadius: 12, color: '#e2e8f0', overflowX: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, lineHeight: 1.6 }}><code>{embedCode}</code></div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: '#64748b' }}>Business ID: <code>{businessId}</code></div>
          <button type="button" onClick={copyCode} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 0, borderRadius: 10, padding: '11px 15px', background: '#172033', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? 'Copied' : 'Copy Embed Code'}</button>
        </div>
      </section>
    </div>}
  </>;
}

function RootAdmin() {
  return <><AdminApp /><EmbedCodePanel /></>;
}

function RootApp() {
  const embedded = new URLSearchParams(window.location.search).get('embed') === '1';
  if (window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')) return <RootAdmin />;
  return <ChatbotApp embedded={embedded} />;
}

createRoot(document.getElementById('root')).render(<RootApp />);
