import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Bot, Building2, ChevronRight, CircleHelp, LogIn, LogOut, MessageSquare, Save, Send, Settings, ShieldCheck, Users, Wrench } from 'lucide-react';
import './styles.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const BUSINESS_SLUG = import.meta.env.VITE_BUSINESS_SLUG || 'aichatbot-test-business';

const emptyProfile = { name: '', description: '', phone: '', email: '', website: '', address: '', city: '', opening_hours: '', booking_policy: '', support_policy: '' };

function App() {
  const [view, setView] = useState(window.location.pathname.startsWith('/admin') ? 'admin' : 'chat');
  const [session, setSession] = useState(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (view === 'admin') return <AdminApp session={session} onBack={() => setView('chat')} />;
  return <ChatApp onAdmin={() => { window.history.pushState({}, '', '/admin'); setView('admin'); }} />;
}

function ChatApp({ onAdmin }) {
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'Hello! I’m your customer support assistant. How can I help you today?' }]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const suggestions = ['What services do you provide?', 'What are your opening hours?', 'How can I make a booking?'];

  async function sendMessage(text = input) {
    const message = text.trim();
    if (!message || loading) return;
    setInput('');
    setMessages((current) => [...current, { role: 'user', content: message }]);
    setLoading(true);
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, conversationId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Request failed');
      setConversationId(data.conversationId || null);
      setMessages((current) => [...current, { role: 'assistant', content: data.answer }]);
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistant', content: 'I’m unable to connect to the support service right now.' }]);
    } finally { setLoading(false); }
  }

  return <div className="app-shell"><div className="chat-card">
    <header className="chat-header"><div className="brand-icon"><Bot size={22} /></div><div><h1>AI Customer Support</h1><p><span className="status-dot" />Online</p></div><button className="admin-link" onClick={onAdmin} title="Admin dashboard"><Settings size={17} /></button></header>
    <main className="chat-body"><div className="welcome"><div className="welcome-icon"><ShieldCheck size={20} /></div><div><h2>How can we help?</h2><p>Ask about services, opening hours, bookings, or other business information.</p></div></div>
      <div className="messages">{messages.map((message, index) => <div className={`message-row ${message.role}`} key={index}><div className="avatar">{message.role === 'assistant' ? <Bot size={15} /> : 'You'}</div><div className="bubble">{message.content}</div></div>)}{loading && <div className="message-row assistant"><div className="avatar"><Bot size={15} /></div><div className="bubble typing">Thinking...</div></div>}</div>
      <div className="suggestions">{suggestions.map((item) => <button key={item} onClick={() => sendMessage(item)}>{item}</button>)}</div>
    </main>
    <form className="composer" onSubmit={(e) => { e.preventDefault(); sendMessage(); }}><input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your question..." disabled={loading} /><button className="send-button" disabled={loading || !input.trim()}><Send size={18} /></button></form><div className="footer-note">Powered by AI customer support</div>
  </div></div>;
}

function AdminApp({ session, onBack }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [authLoading, setAuthLoading] = useState(false); const [authError, setAuthError] = useState('');
  const [section, setSection] = useState('overview'); const [businessId, setBusinessId] = useState(null); const [business, setBusiness] = useState(null); const [services, setServices] = useState([]); const [faqs, setFaqs] = useState([]); const [conversations, setConversations] = useState([]); const [leads, setLeads] = useState([]); const [loading, setLoading] = useState(false);

  useEffect(() => { if (session) loadAdmin(); }, [session]);

  async function login(e) { e.preventDefault(); setAuthLoading(true); setAuthError(''); const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) setAuthError(error.message); setAuthLoading(false); }
  async function logout() { await supabase.auth.signOut(); }

  async function loadAdmin() {
    setLoading(true);
    try {
      const { data: membership, error: membershipError } = await supabase.from('business_admins').select('business_id').eq('user_id', session.user.id).eq('status', 'active').maybeSingle();
      if (membershipError) throw membershipError;
      let id = membership?.business_id;
      if (!id) {
        const { data: found, error } = await supabase.from('businesses').select('id').eq('slug', BUSINESS_SLUG).single();
        if (error) throw new Error('Your account is not assigned to a business yet.');
        id = found.id;
      }
      setBusinessId(id);
      const [b, info, s, f, c, l] = await Promise.all([
        supabase.from('businesses').select('*').eq('id', id).single(),
        supabase.from('business_info').select('key,value').eq('business_id', id),
        supabase.from('services').select('*').eq('business_id', id).order('created_at', { ascending: false }),
        supabase.from('faqs').select('*').eq('business_id', id).order('created_at', { ascending: false }),
        supabase.from('conversations').select('*').eq('business_id', id).order('created_at', { ascending: false }).limit(50),
        supabase.from('leads').select('*').eq('business_id', id).order('created_at', { ascending: false }).limit(50)
      ]);
      if (b.error) throw b.error;
      const infoMap = Object.fromEntries((info.data || []).map((row) => [row.key, row.value]));
      setBusiness({ ...b.data, ...infoMap }); setServices(s.data || []); setFaqs(f.data || []); setConversations(c.data || []); setLeads(l.data || []);
    } catch (error) { setAuthError(error.message || 'Could not load dashboard.'); } finally { setLoading(false); }
  }

  if (!supabase) return <div className="admin-page"><div className="auth-card"><h1>Admin setup incomplete</h1><p>Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to Vercel.</p></div></div>;
  if (!session) return <div className="admin-page"><form className="auth-card" onSubmit={login}><div className="auth-logo"><Bot size={22} /></div><h1>Admin Login</h1><p>Sign in to manage your AI customer support business.</p><input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required /><input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required /><button className="primary-btn" disabled={authLoading}><LogIn size={17} />{authLoading ? 'Signing in...' : 'Sign in'}</button>{authError && <div className="error-box">{authError}</div>}<button type="button" className="back-link" onClick={onBack}>← Back to chatbot</button></form></div>;

  const nav = [['overview', 'Overview', Building2], ['business', 'Business Profile', Settings], ['services', 'Services', Wrench], ['faqs', 'FAQs', CircleHelp], ['conversations', 'Conversations', MessageSquare], ['leads', 'Leads', Users]];
  return <div className="admin-layout"><aside className="sidebar"><div className="side-brand"><div className="brand-icon"><Bot size={21} /></div><div><strong>AI Support</strong><span>Admin</span></div></div><nav>{nav.map(([key, label, Icon]) => <button key={key} className={section === key ? 'active' : ''} onClick={() => setSection(key)}><Icon size={17} />{label}</button>)}</nav><div className="side-bottom"><button onClick={onBack}><ChevronRight size={17} />View chatbot</button><button onClick={logout}><LogOut size={17} />Sign out</button></div></aside><main className="admin-main"><div className="topbar"><div><span className="eyebrow">Dashboard</span><h1>{nav.find((x) => x[0] === section)?.[1]}</h1></div><div className="user-chip">{session.user.email}</div></div>{loading ? <div className="loading-card">Loading your business data...</div> : <Section section={section} business={business} setBusiness={setBusiness} businessId={businessId} services={services} setServices={setServices} faqs={faqs} setFaqs={setFaqs} conversations={conversations} leads={leads} reload={loadAdmin} />}</main></div>;
}

function Section({ section, business, setBusiness, businessId, services, setServices, faqs, setFaqs, conversations, leads, reload }) {
  if (section === 'overview') return <><div className="stats-grid"><Stat icon={Wrench} label="Services" value={services.length} /><Stat icon={CircleHelp} label="FAQs" value={faqs.length} /><Stat icon={MessageSquare} label="Conversations" value={conversations.length} /><Stat icon={Users} label="Leads" value={leads.length} /></div><div className="panel"><h2>Business status</h2><p className="muted">Your chatbot is connected to <strong>{business?.name}</strong>. Changes made here can be reflected in customer answers.</p></div></>;
  if (section === 'business') return <BusinessForm business={business} setBusiness={setBusiness} businessId={businessId} />;
  if (section === 'services') return <CrudSection title="Services" type="services" rows={services} setRows={setServices} businessId={businessId} reload={reload} />;
  if (section === 'faqs') return <CrudSection title="FAQs" type="faqs" rows={faqs} setRows={setFaqs} businessId={businessId} reload={reload} />;
  if (section === 'conversations') return <DataTable title="Recent Conversations" rows={conversations} columns={['session_id', 'status', 'created_at']} empty="No conversations yet." />;
  return <DataTable title="Leads" rows={leads} columns={['name', 'email', 'phone', 'message', 'status', 'created_at']} empty="No leads yet." />;
}

function Stat({ icon: Icon, label, value }) { return <div className="stat-card"><div className="stat-icon"><Icon size={19} /></div><div><strong>{value}</strong><span>{label}</span></div></div>; }

function BusinessForm({ business, setBusiness, businessId }) {
  const [form, setForm] = useState(business || emptyProfile); const [saving, setSaving] = useState(false); const [saved, setSaved] = useState('');
  useEffect(() => setForm(business || emptyProfile), [business]);
  function change(key, value) { setForm((f) => ({ ...f, [key]: value })); }
  async function save(e) { e.preventDefault(); setSaving(true); setSaved(''); const base = { name: form.name, description: form.description, phone: form.phone, email: form.email, website: form.website, address: form.address, city: form.city }; const { error } = await supabase.from('businesses').update(base).eq('id', businessId); if (!error) { for (const key of ['opening_hours', 'booking_policy', 'support_policy']) await supabase.from('business_info').upsert({ business_id: businessId, key, value: form[key] || '' }, { onConflict: 'business_id,key' }); setBusiness(form); setSaved('Saved successfully.'); } else setSaved(error.message); setSaving(false); }
  const fields = [['name','Business name'],['description','Description'],['phone','Phone'],['email','Email'],['website','Website'],['address','Address'],['city','City'],['opening_hours','Opening hours'],['booking_policy','Booking policy'],['support_policy','Support policy']];
  return <form className="panel form-panel" onSubmit={save}><div className="panel-heading"><div><h2>Business Profile</h2><p>Manage the information your AI assistant can use.</p></div><button className="primary-btn small"><Save size={16} />{saving ? 'Saving...' : 'Save changes'}</button></div><div className="form-grid">{fields.map(([key, label]) => <label key={key} className={['description','booking_policy','support_policy'].includes(key) ? 'wide' : ''}><span>{label}</span>{['description','booking_policy','support_policy'].includes(key) ? <textarea rows="3" value={form[key] || ''} onChange={(e) => change(key, e.target.value)} /> : <input value={form[key] || ''} onChange={(e) => change(key, e.target.value)} />}</label>)}</div>{saved && <div className="save-note">{saved}</div>}</form>;
}

function CrudSection({ title, type, rows, setRows, businessId, reload }) {
  const [editing, setEditing] = useState(null); const [saving, setSaving] = useState(false);
  const blank = type === 'services' ? { name:'', description:'', price:'', currency:'PKR', availability:'' } : { question:'', answer:'', category:'' };
  async function save(e) { e.preventDefault(); setSaving(true); const payload = { ...editing, business_id: businessId }; if (type === 'services' && payload.price !== '') payload.price = Number(payload.price); const result = editing.id ? await supabase.from(type).update(payload).eq('id', editing.id).eq('business_id', businessId) : await supabase.from(type).insert(payload); if (!result.error) { setEditing(null); await reload(); } else alert(result.error.message); setSaving(false); }
  async function remove(id) { if (!confirm('Delete this item?')) return; const { error } = await supabase.from(type).delete().eq('id', id).eq('business_id', businessId); if (error) alert(error.message); else await reload(); }
  return <div><div className="section-actions"><div><h2>{title}</h2><p className="muted">Keep the knowledge used by the chatbot accurate.</p></div><button className="primary-btn" onClick={() => setEditing(blank)}>Add {type === 'services' ? 'service' : 'FAQ'}</button></div>{editing && <form className="panel edit-panel" onSubmit={save}>{type === 'services' ? <><input placeholder="Service name" value={editing.name} onChange={(e)=>setEditing({...editing,name:e.target.value})} required /><textarea placeholder="Description" value={editing.description || ''} onChange={(e)=>setEditing({...editing,description:e.target.value})}/><div className="two-inputs"><input type="number" placeholder="Price" value={editing.price} onChange={(e)=>setEditing({...editing,price:e.target.value})}/><input placeholder="Currency" value={editing.currency} onChange={(e)=>setEditing({...editing,currency:e.target.value})}/></div><input placeholder="Availability" value={editing.availability || ''} onChange={(e)=>setEditing({...editing,availability:e.target.value})}/></> : <><input placeholder="Question" value={editing.question} onChange={(e)=>setEditing({...editing,question:e.target.value})} required /><textarea placeholder="Answer" value={editing.answer} onChange={(e)=>setEditing({...editing,answer:e.target.value})} required /><input placeholder="Category" value={editing.category || ''} onChange={(e)=>setEditing({...editing,category:e.target.value})}/></>}<div className="edit-actions"><button type="button" className="secondary-btn" onClick={()=>setEditing(null)}>Cancel</button><button className="primary-btn" disabled={saving}>{saving?'Saving...':'Save'}</button></div></form>}<div className="cards-list">{rows.map((row)=><div className="data-card" key={row.id}><div><strong>{row.name || row.question}</strong><p>{row.description || row.answer}</p>{type==='services' && <small>{row.price ?? 0} {row.currency || 'PKR'} · {row.availability || 'Availability not specified'}</small>}</div><div className="row-actions"><button onClick={()=>setEditing({...row})}>Edit</button><button className="danger" onClick={()=>remove(row.id)}>Delete</button></div></div>)}{!rows.length && <div className="empty-card">No {type} added yet.</div>}</div></div>;
}

function DataTable({ title, rows, columns, empty }) { return <div className="panel table-panel"><div className="panel-heading"><div><h2>{title}</h2><p>Latest records from your chatbot.</p></div></div>{rows.length ? <div className="table-wrap"><table><thead><tr>{columns.map(c=><th key={c}>{c.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id}>{columns.map(c=><td key={c}>{c==='created_at' ? new Date(row[c]).toLocaleString() : String(row[c] ?? '—')}</td>)}</tr>)}</tbody></table></div> : <div className="empty-card">{empty}</div>}</div>; }

export default App;
