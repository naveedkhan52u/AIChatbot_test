import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bot, Send, Sparkles, UserRound } from 'lucide-react';
import './styles.css';

const suggestions = [
  'What services do you provide?',
  'What are your opening hours?',
  'How can I make a booking?',
];

function App() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hello! I’m your AI customer support assistant. Ask me about our services, prices, opening hours, or bookings.',
    },
  ]);
  const [input, setInput] = useState('');

  function sendMessage(text = input) {
    const value = text.trim();
    if (!value) return;
    setMessages((current) => [
      ...current,
      { role: 'user', text: value },
      { role: 'assistant', text: 'Thanks. I received your question. The AI knowledge connection will be enabled in the next step.' },
    ]);
    setInput('');
  }

  return (
    <main className="app-shell">
      <section className="chat-card">
        <header className="chat-header">
          <div className="brand-icon"><Bot size={24} /></div>
          <div>
            <h1>AI Customer Support</h1>
            <p><span className="status-dot" /> Online assistant</p>
          </div>
        </header>

        <div className="chat-body">
          <div className="welcome">
            <div className="welcome-icon"><Sparkles size={22} /></div>
            <div>
              <h2>How can I help?</h2>
              <p>Ask a question or choose one of the common questions below.</p>
            </div>
          </div>

          <div className="messages">
            {messages.map((message, index) => (
              <div key={index} className={`message-row ${message.role}`}>
                <div className="avatar">{message.role === 'assistant' ? <Bot size={17} /> : <UserRound size={17} />}</div>
                <div className="bubble">{message.text}</div>
              </div>
            ))}
          </div>

          <div className="suggestions">
            {suggestions.map((item) => (
              <button key={item} onClick={() => sendMessage(item)}>{item}</button>
            ))}
          </div>
        </div>

        <footer className="composer">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && sendMessage()}
            placeholder="Type your question..."
            aria-label="Type your question"
          />
          <button className="send-button" onClick={() => sendMessage()} aria-label="Send message"><Send size={19} /></button>
        </footer>
        <div className="footer-note">Powered by AI • Your conversation is handled securely</div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);