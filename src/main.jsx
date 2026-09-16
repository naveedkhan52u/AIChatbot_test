import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bot, Send, Sparkles, UserRound } from 'lucide-react';
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

  async function sendMessage(text = input) {
    const value = text.trim();
    if (!value || loading) return;
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
      <div className="messages">{messages.map((message, index) => <div key={index} className={`message-row ${message.role}`}><div className="avatar">{message.role === 'assistant' ? <Bot size={17} /> : <UserRound size={17} />}</div><div className="bubble">{message.text}</div></div>)}{loading && <div className="message-row assistant"><div className="avatar"><Bot size={17} /></div><div className="bubble typing">Thinking...</div></div>}</div>
      <div className="suggestions">{suggestions.map(item => <button key={item} onClick={() => sendMessage(item)} disabled={loading}>{item}</button>)}</div>
    </div>
    <footer className="composer"><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Type your question..." aria-label="Type your question" disabled={loading} /><button className="send-button" onClick={() => sendMessage()} disabled={loading} aria-label="Send message"><Send size={19} /></button></footer>
    <div className="footer-note">Powered by AI • Your conversation is handled securely</div>
  </section></main>;
}

function RootApp() {
  const embedded = new URLSearchParams(window.location.search).get('embed') === '1';
  if (window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')) return <AdminApp />;
  return <ChatbotApp embedded={embedded} />;
}

createRoot(document.getElementById('root')).render(<RootApp />);
