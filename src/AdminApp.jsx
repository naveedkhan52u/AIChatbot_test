import React, { useEffect, useRef, useState } from 'react';
import { getSupabase } from './lib/supabase';
import { Bot, BriefcaseBusiness, CircleUserRound, FileText, HelpCircle, LogOut, MessageSquare, Settings, Upload, Wrench, BookOpen, Plus, ShieldCheck } from 'lucide-react';
import AccountSettings from './AccountSettings';
import mammoth from 'mammoth/mammoth.browser';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const SUPER_ADMIN_EMAIL = 'naveedkhanu@gmail.com';
const emptyBusiness = { name: '', description: '', phone: '', email: '', website: '', address: '', city: '' };
const emptyKnowledge = { opening_hours: '', booking_policy: '', cancellation_policy: '', payment_methods: '', support_policy: '' };
const emptyCreateBusiness = { businessName: '', clientName: '', clientEmail: '', phone: '', city: '', description: '' };

async function extractDocumentText(file) {
  if (file.type === 'text/plain' || file.type === 'text/csv') return file.text();
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value || '';
  }
  if (file.type === 'application/pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => item.str || '').join(' '));
    }
    return pages.join('\n\n').trim();
  }
  return '';
}

function Login({ onLoggedIn }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  async function submit(event) { event.preventDefault(); setLoading(true); setError(''); try { const { data, error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password }); if (error) throw error; if (!data.session) throw new Error('Login did not create a session.'); onLoggedIn(data.session); } catch (err) { setError(err.message || 'Unable to sign in.'); } finally { setLoading(false); } }
  return <main className="admin-page"><form className="auth-card" onSubmit={submit}><div className="auth-logo"><Bot size={24} /></div><h1>Admin Login</h1><p>Sign in with an authorized business admin account.</p><label><span>Email</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label><label><span>Password</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label><button className="primary-btn" type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>{error && <div className="error-box">{error}</div>}<button className="back-link" type="button" onClick={() => { window.location.href = '/'; }}>Back to chatbot</button></form></main>;
}

function CreateBusiness({ session, onDone }) {
  const [form, setForm] = useState(emptyCreateBusiness); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const { data: sessionData } = await getSupabase().auth.getSession();
      const accessToken = sessionData.session?.access_token || session.access_token;
      const response = await fetch('/api/admin-create-business', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create business.');
      setForm(emptyCreateBusiness); setNotice(`✓ ${data.business.name} created. An invitation was sent to ${data.business.clientEmail}.`);
      if (onDone) onDone();
    } catch (err) { setError(err.message || 'Could not create business.'); } finally { setSaving(false); }
  }
  return <div className="super-admin-page"><div className="panel super-admin-card"><div className="section-heading"><div><h2><ShieldCheck size={19} /> Create Business + Invite Client</h2><p className="muted">Create a separate business workspace and send the client their own Supabase invitation.</p></div></div>{error && <div className="error-box">{error}</div>}{notice && <div className="save-note">{notice}</div>}<form className="form-panel" onSubmit={submit}><div className="form-grid"><label><span>Business name *</span><input value={form.businessName} onChange={e => setForm({ ...form, businessName: e.target.value })} required /></label><label><span>Client name</span><input value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} /></label><label><span>Client email *</span><input type="email" value={form.clientEmail} onChange={e => setForm({ ...form, clientEmail: e.target.value })} required /></label><label><span>Phone</span><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label><label><span>City</span><input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></label><label className="wide"><span>Description</span><textarea rows="4" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label></div><div className="edit-actions"><button type="button" className="secondary-btn" onClick={() => { setForm(emptyCreateBusiness); setError(''); setNotice(''); }}>Clear</button><button className="primary-btn" type="submit" disabled={saving}><Plus size={16} />{saving ? 'Creating & inviting...' : 'Create Business + Invite Client'}</button></div></form></div></div>;
}

function AdminDashboard({ session, onSignOut }) {
  const [businessId, setBusinessId] = useState(null); const [business, setBusiness] = useState(emptyBusiness); const [knowledge, setKnowledge] = useState(emptyKnowledge); const [documents, setDocuments] = useState([]); const [customText, setCustomText] = useState('');
  const [counts, setCounts] = useState({ services: 0, faqs: 0, conversations: 0, leads: 0 }); const [section, setSection] = useState('overview'); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [uploading, setUploading] = useState(false); const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const fileInputRef = useRef(null); const supabase = getSupabase();
  const isSuperAdmin = session.user.email?.toLowerCase() === SUPER_ADMIN_EMAIL;

  useEffect(() => { loadAdmin(); }, []);
  async function loadAdmin() {
    setLoading(true); setError('');
    try {
      const { data: membership, error: membershipError } = await supabase.from('business_admins').select('business_id, role').eq('user_id', session.user.id).maybeSingle();
      if (membershipError) throw membershipError; if (!membership?.business_id) throw new Error('Your account is not assigned to a business yet.');
      setBusinessId(membership.business_id);
      const [businessResult, services, faqs, conversations, leads, infoResult, docsResult] = await Promise.all([
        supabase.from('businesses').select('id,name,description,phone,email,website,address,city').eq('id', membership.business_id).single(),
        supabase.from('services').select('id', { count: 'exact', head: true }).eq('business_id', membership.business_id), supabase.from('faqs').select('id', { count: 'exact', head: true }).eq('business_id', membership.business_id), supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('business_id', membership.business_id), supabase.from('leads').select('id', { count: 'exact', head: true }).eq('business_id', membership.business_id),
        supabase.from('business_info').select('key,value').eq('business_id', membership.business_id), supabase.from('knowledge_documents').select('id,title,file_name,file_type,storage_path,status,created_at').eq('business_id', membership.business_id).order('created_at', { ascending: false })
      ]);
      if (businessResult.error) throw businessResult.error; for (const result of [services, faqs, conversations, leads, infoResult, docsResult]) if (result.error) throw result.error;
      setBusiness(businessResult.data || emptyBusiness); setCounts({ services: services.count || 0, faqs: faqs.count || 0, conversations: conversations.count || 0, leads: leads.count || 0 }); const info = Object.fromEntries((infoResult.data || []).map(row => [row.key, row.value]));
      setKnowledge({ opening_hours: info.opening_hours || '', booking_policy: info.booking_policy || '', cancellation_policy: info.cancellation_policy || '', payment_methods: info.payment_methods || '', support_policy: info.support_policy || '' }); setCustomText(info.custom_knowledge || ''); setDocuments(docsResult.data || []);
    } catch (err) { setError(err.message || 'Could not load the admin dashboard.'); } finally { setLoading(false); }
  }

  async function saveBusiness(event) { event.preventDefault(); if (!businessId || saving) return; setSaving(true); setNotice(''); setError(''); try { const payload = { name: (business.name || '').trim(), description: business.description || '', phone: business.phone || '', email: business.email || '', website: business.website || '', address: business.address || '', city: business.city || '' }; if (!payload.name) throw new Error('Business name is required.'); const { data, error } = await supabase.from('businesses').update(payload).eq('id', businessId).select('id,name,description,phone,email,website,address,city').single(); if (error) throw error; if (!data) throw new Error('No business record was updated.'); setBusiness(data); setNotice('✓ Business profile saved successfully.'); } catch (err) { setError(`Profile could not be saved: ${err.message || 'Unknown error'}`); } finally { setSaving(false); } }
  async function saveKnowledge(event) { event.preventDefault(); if (!businessId || saving) return; setSaving(true); setNotice(''); setError(''); try { const rows = [...Object.entries(knowledge), ['custom_knowledge', customText]].map(([key, value]) => ({ business_id: businessId, key, value: value || '' })); const { error } = await supabase.from('business_info').upsert(rows, { onConflict: 'business_id,key' }); if (error) throw error; setNotice('✓ Knowledge saved successfully. The chatbot can now use this information.'); } catch (err) { setError(`Knowledge could not be saved: ${err.message || 'Unknown error'}`); } finally { setSaving(false); } }
  function chooseFile() { setError(''); setNotice(''); fileInputRef.current?.click(); }
  async function uploadDocument(event) { const file = event.target.files?.[0]; event.target.value = ''; if (!file || !businessId || uploading) return; const allowed = ['application/pdf','text/plain','text/csv','application/vnd.openxmlformats-officedocument.wordprocessingml.document']; if (!allowed.includes(file.type)) { setError('Please upload a PDF, DOCX, TXT, or CSV file.'); return; } if (file.size > 10 * 1024 * 1024) { setError('Maximum file size is 10 MB.'); return; } setUploading(true); setNotice(''); setError(''); try { setNotice(`Reading ${file.name}...`); const extractedText = (await extractDocumentText(file)).replace(/\u0000/g, '').trim(); if (!extractedText) throw new Error('No readable text was found in this document. Scanned/image-only PDFs are not supported yet.'); const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_'); const path = `${businessId}/${crypto.randomUUID()}-${safeName}`; const { error: uploadError } = await supabase.storage.from('business-knowledge').upload(path, file, { contentType: file.type, upsert: false }); if (uploadError) throw uploadError; const { data, error: insertError } = await supabase.from('knowledge_documents').insert({ business_id: businessId, title: file.name.replace(/\.[^.]+$/, ''), file_name: file.name, file_type: file.type, storage_path: path, extracted_text: extractedText, status: 'ready' }).select('id,title,file_name,file_type,storage_path,status,created_at').single(); if (insertError) { await supabase.storage.from('business-knowledge').remove([path]); throw insertError; } setDocuments(current => [data, ...current]); setNotice(`✓ ${file.name} processed successfully. The chatbot can now use its contents.`); } catch (err) { setError(`Document processing failed: ${err.message || 'Unknown error'}`); } finally { setUploading(false); } }
  async function deleteDocument(doc) { setError(''); setNotice(''); try { const { error: storageError } = await supabase.storage.from('business-knowledge').remove([doc.storage_path].filter(Boolean)); if (storageError) throw storageError; const { error } = await supabase.from('knowledge_documents').delete().eq('id', doc.id).eq('business_id', businessId); if (error) throw error; setDocuments(current => current.filter(item => item.id !== doc.id)); setNotice('✓ Document removed.'); } catch (err) { setError(`Document could not be removed: ${err.message || 'Unknown error'}`); } }
  async function signOut() { await supabase.auth.signOut(); onSignOut(); }

  const nav = [['overview', <BriefcaseBusiness size={17} />, 'Overview'], ['business', <Settings size={17} />, 'Business Profile'], ['knowledge', <BookOpen size={17} />, 'Knowledge Base'], ['services', <Wrench size={17} />, 'Services'], ['faqs', <HelpCircle size={17} />, 'FAQs'], ['conversations', <MessageSquare size={17} />, 'Conversations'], ['leads', <CircleUserRound size={17} />, 'Leads'], ['account-settings', <ShieldCheck size={17} />, 'Account Settings']];
  if (isSuperAdmin) nav.splice(1, 0, ['create-business', <Plus size={17} />, 'Create Business']);
  if (loading) return <main className="admin-page"><div className="loading-card">Loading your secure admin workspace...</div></main>;

  return <div className="admin-layout"><aside className="sidebar"><div className="side-brand"><div className="brand-icon"><Bot size={20} /></div><div><strong>AI Support</strong><span>{isSuperAdmin ? 'Super Admin' : 'Business Admin'}</span></div></div><nav>{nav.map(([key, icon, label]) => <button key={key} className={section === key ? 'active' : ''} onClick={() => { setSection(key); setNotice(''); setError(''); }}>{icon}{label}</button>)}</nav><div className="side-bottom"><button onClick={signOut}><LogOut size={17} /> Sign out</button><button onClick={() => { window.location.href = '/'; }}><Bot size={17} /> Public chatbot</button></div></aside>
    <main className="admin-main"><div className="topbar"><div><div className="eyebrow">{isSuperAdmin ? 'Platform control' : 'Secure workspace'}</div><h1>{section === 'overview' ? 'Dashboard' : nav.find(x => x[0] === section)?.[2]}</h1></div><div className="user-chip">{session.user.email}</div></div>{error && <div className="error-box">{error}</div>}{notice && <div className="save-note">{notice}</div>}
      {section === 'create-business' && isSuperAdmin && <CreateBusiness session={session} onDone={() => setSection('overview')} />}
      {section === 'account-settings' && <AccountSettings session={session} setError={setError} setNotice={setNotice} />}
      {section === 'overview' && <><div className="stats-grid">{[['Services', counts.services, Wrench], ['FAQs', counts.faqs, HelpCircle], ['Conversations', counts.conversations, MessageSquare], ['Leads', counts.leads, CircleUserRound]].map(([label, value, Icon]) => <div className="stat-card" key={label}><div className="stat-icon"><Icon size={19} /></div><div><strong>{value}</strong><span>{label}</span></div></div>)}</div><div className="panel"><h2>{business.name}</h2><p className="muted">{business.description || 'Add your business description from Business Profile.'}</p><p className="muted">Only an authenticated user with a matching business membership can access this workspace.</p></div></>}
      {section === 'business' && <form className="panel form-panel" onSubmit={saveBusiness}><h2>Business Profile</h2><p className="muted">These details are used by the support system as business knowledge.</p><div className="form-grid">{['name','phone','email','website','address','city'].map(key => <label key={key}><span>{key}</span><input value={business[key] || ''} onChange={e => setBusiness({ ...business, [key]: e.target.value })} required={key === 'name'} /></label>)}<label className="wide"><span>description</span><textarea rows="5" value={business.description || ''} onChange={e => setBusiness({ ...business, description: e.target.value })} /></label></div><button className="primary-btn" type="submit" disabled={saving}>{saving ? 'Saving profile...' : 'Save profile'}</button></form>}
      {section === 'knowledge' && <div className="knowledge-grid"><form className="panel form-panel" onSubmit={saveKnowledge}><h2>Custom Business Knowledge</h2><p className="muted">Add information the chatbot should know and use when answering customers.</p><div className="form-grid">{[['opening_hours','Opening hours'],['booking_policy','Booking policy'],['cancellation_policy','Cancellation policy'],['payment_methods','Payment methods'],['support_policy','Support policy']].map(([key,label]) => <label className="wide" key={key}><span>{label}</span><textarea rows="3" value={knowledge[key]} onChange={e => setKnowledge({ ...knowledge, [key]: e.target.value })} /></label>)}<label className="wide"><span>Custom knowledge / additional information</span><textarea rows="10" value={customText} onChange={e => setCustomText(e.target.value)} placeholder="Add detailed business information, products, services, policies, FAQs, special instructions, etc." /></label></div><button className="primary-btn" type="submit" disabled={saving}>{saving ? 'Saving knowledge...' : 'Save knowledge'}</button></form><div className="panel"><h2>Business Documents</h2><p className="muted">Upload PDF, DOCX, TXT, or CSV files. Text is extracted before the file is marked ready.</p><button type="button" className="upload-box" onClick={chooseFile} disabled={uploading}><Upload size={22} /><strong>{uploading ? 'Processing...' : 'Choose document'}</strong><span>PDF, DOCX, TXT, CSV • max 10 MB</span></button><input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.csv,application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={uploadDocument} disabled={uploading} style={{ display: 'none' }} /><div className="document-list">{documents.length === 0 ? <p className="muted">No documents uploaded yet.</p> : documents.map(doc => <div className="document-item" key={doc.id}><FileText size={20} /><div><strong>{doc.file_name}</strong><span>{doc.status === 'ready' ? 'Text extracted and ready for chatbot' : 'Processing required'}</span></div><button type="button" onClick={() => deleteDocument(doc)}>Delete</button></div>)}</div></div></div>}
      {['services','faqs','conversations','leads'].includes(section) && <DataSection section={section} businessId={businessId} supabase={supabase} setError={setError} setNotice={setNotice} />}
    </main></div>;
}

function DataSection({ section, businessId, supabase, setError, setNotice }) {
  const [items, setItems] = useState([]); const [editing, setEditing] = useState(null); const [form, setForm] = useState({}); const [loading, setLoading] = useState(true);
  const configs = { services: { title: 'Services', table: 'services', fields: ['name','description','price','currency','availability','status'] }, faqs: { title: 'FAQs', table: 'faqs', fields: ['question','answer','category','status'] } };
  useEffect(() => { if (configs[section]) load(); else setLoading(false); }, [section, businessId]);
  async function load() { setLoading(true); const config = configs[section]; const { data, error } = await supabase.from(config.table).select(`id,${config.fields.join(',')}`).eq('business_id', businessId).order('created_at', { ascending: false }); if (error) setError(error.message); else setItems(data || []); setLoading(false); }
  if (!configs[section]) return <div className="panel"><h2>{section[0].toUpperCase() + section.slice(1)}</h2><p className="muted">{section === 'conversations' ? 'Customer conversations are available here.' : 'Lead records are available here.'}</p></div>;
  const config = configs[section];
  async function save() { const payload = { ...form, business_id: businessId }; const result = editing ? await supabase.from(config.table).update(payload).eq('id', editing).eq('business_id', businessId) : await supabase.from(config.table).insert(payload); if (result.error) setError(result.error.message); else { setNotice(`✓ ${config.title} saved.`); setEditing(null); setForm({}); load(); } }
  async function remove(id) { const result = await supabase.from(config.table).delete().eq('id', id).eq('business_id', businessId); if (result.error) setError(result.error.message); else { setNotice(`✓ ${config.title.slice(0,-1)} removed.`); load(); } }
  return <div><div className="section-actions"><div><h2>{config.title}</h2><p className="muted">Manage the business knowledge used by the chatbot.</p></div><button className="primary-btn small" onClick={() => { setEditing('new'); setForm({ status: 'active' }); }}>Add {config.title.slice(0,-1)}</button></div>{editing && <div className="panel edit-panel"><div className="form-grid">{config.fields.filter(field => field !== 'status' || section !== 'services').map(field => <label key={field}><span>{field}</span><input value={form[field] || ''} onChange={e => setForm({ ...form, [field]: e.target.value })} /></label>)}</div><div className="edit-actions"><button className="secondary-btn" onClick={() => { setEditing(null); setForm({}); }}>Cancel</button><button className="primary-btn" onClick={save}>Save</button></div></div>}{loading ? <div className="loading-card">Loading...</div> : <div className="cards-list">{items.map(item => <div className="data-card" key={item.id}><div><strong>{item.name || item.question}</strong><p>{item.description || item.answer}</p><small>{item.price ? `${item.price} ${item.currency || ''}` : item.category || item.status}</small></div><div className="row-actions"><button onClick={() => { setEditing(item.id); setForm(item); }}>Edit</button><button className="danger" onClick={() => remove(item.id)}>Delete</button></div></div>)}</div>}</div>;
}

export default function AdminApp() {
  const [session, setSession] = useState(null); const [checking, setChecking] = useState(true); const supabase = getSupabase();
  useEffect(() => { supabase.auth.getSession().then(({ data }) => { setSession(data.session || null); setChecking(false); }); const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession)); return () => listener.subscription.unsubscribe(); }, []);
  if (checking) return <main className="admin-page"><div className="loading-card">Checking secure session...</div></main>;
  if (!session) return <Login onLoggedIn={setSession} />;
  return <AdminDashboard session={session} onSignOut={() => setSession(null)} />;
}
