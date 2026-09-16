import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bot, Mic, Send, Sparkles, UserRound, Volume2, Square } from 'lucide-react';
import AdminApp from './AdminApp';
import './styles.css';

const suggestions = ['What services do you provide?', 'What are your opening hours?', 'How can I make a booking?'];

function ChatbotApp({ embedded = false }) {
  const params = new URLSearchParams(window.location.search);
  const businessId = params.get('businessId');
  const businessSlug = params.get('businessSlug');
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'Hello! I’m your AI customer support assistant. Ask me about our services, prices, opening hours, or bookings.' }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [speakingIndex, setSpeakingIndex] = useState(null);
  const recognitionRef = useRef(null);

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
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  function toggleListening() {
    if (!speechSupported) {
      setMessages(current => [...current, { role: 'assistant', text: 'Voice input is not supported by this browser. Please use Chrome or Edge, or type your question.' }]);
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    try {
      recognitionRef.current?.start();
    } catch (error) {
      console.error(error);
    }
  }

  function readResponse(text, index) {
    if (!('speechSynthesis' in window)) {
      setMessages(current => [...current, { role: 'assistant', text: 'Voice playback is not supported by this browser.' }]);
      return;
    }
    window.speechSynthesis.cancel();
    if (speakingIndex === index) {
      setSpeakingIndex(null);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1;
    utterance.onstart = () => setSpeakingIndex(index);
    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);
    setSpeakingIndex(index);
    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  async function sendMessage(text = input) {
    const value = text.trim();
    if (!value || loading) return;
    if (listening) recognitionRef.current?.stop();
    setMessages(current => [...current, { role: 'user', text: value }]);
    setInput(''); setLoading(true);
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: value, conversationId, businessId, businessSlug }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Request failed');
      setConversationId(data.conversationId || conversationId);
      setMessages(current => [...current, { role: 'assistant', text: data.answer }]);
    } catch (error) {
      setMessages(current => [...current, { role: 'assistant', text: 'I’m unable to connect to the support service right now. Please try again shortly.' }]);
      console.error(error);
    } finally { setLoading(false); }
  }

  return <main className={`app-shell${embedded ? ' embedded-shell' : ''}`}><section className="chat-card">
    <header className="chat-header"><div className="brand-icon"><Bot size={24} /></div><div><h1>AI Customer Support</h1><p><span className="status-dot" /> Online assistant</p></div>{!embedded && <button className="admin-link" onClick={() => { window.location.href = '/admin'; }}>Admin</button>}</header>
    <div className="chat-body"><div className="welcome"><div className="welcome-icon"><Sparkles size={22} /></div><div><h2>How can I help?</h2><p>Ask a question or choose one of the common questions below.</p></div></div>
      <div className="messages">{messages.map((message, index) => <div key={index} className={`message-row ${message.role}`}><div className="avatar">{message.role === 'assistant' ? <Bot size={17} /> : <UserRound size={17} />}</div><div className="bubble-wrap">{message.role === 'assistant' && <button className={`read-button${speakingIndex === index ? ' active' : ''}`} onClick={() => readResponse(message.text, index)} aria-label={speakingIndex === index ? 'Stop reading response' : 'Read response aloud'}>{speakingIndex === index ? <Square size={11} /> : <Volume2 size={12} />}<span>{speakingIndex === index ? 'Stop' : 'Read'}</span></button>}<div className="bubble">{message.text}</div></div></div>)}{loading && <div className="message-row assistant"><div className="avatar"><Bot size={17} /></div><div className="bubble typing">Thinking...</div></div>}</div>
      <div className="suggestions">{suggestions.map(item => <button key={item} onClick={() => sendMessage(item)} disabled={loading}>{item}</button>)}</div>
    </div>
    <footer className="composer"><button className={`mic-button${listening ? ' listening' : ''}`} onClick={toggleListening} disabled={loading} aria-label={listening ? 'Stop listening' : 'Speak your question'} title={speechSupported ? (listening ? 'Stop listening' : 'Speak') : 'Voice input is not supported'}><Mic size={18} /></button><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder={listening ? 'Listening...' : 'Type or speak your question...'} aria-label="Type or speak your question" disabled={loading} /><button className="send-button" onClick={() => sendMessage()} disabled={loading} aria-label="Send message"><Send size={19} /></button></footer>
    <div className="footer-note">Powered by AI • Your conversation is handled securely</div>
  </section></main>;
}

function RootApp() {
  const embedded = new URLSearchParams(window.location.search).get('embed') === '1';
  if (window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')) return <AdminApp />;
  return <ChatbotApp embedded={embedded} />;
}

createRoot(document.getElementById('root')).render(<RootApp />);
