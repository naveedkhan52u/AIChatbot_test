import React, { useEffect, useRef, useState } from 'react';
import { getSupabase } from './lib/supabase';
import { Bot, BriefcaseBusiness, CircleUserRound, FileText, HelpCircle, LogOut, MessageSquare, Settings, Upload, Wrench, BookOpen } from 'lucide-react';
import mammoth from 'mammoth/mammoth.browser';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const emptyBusiness = { name: '', description: '', phone: '', email: '', website: '', address: '', city: '' };
const emptyKnowledge = { opening_hours: '', booking_policy: '', cancellation_policy: '', payment_methods: '', support_policy: '' };

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

function AdminDashboard({ session, onSignOut }) {
  const [businessId, setBusinessId] = useState(null); const [business, setBusiness] = useState(emptyBusiness); const [knowledge, setKnowledge] = useState(emptyKnowledge); const [documents, setDocuments] = useState([]); const [customText, setCustomText] = useState('');
  const [counts, setCounts] = useState({ services: 0, faqs: 0, conversations: 0, leads: 0 }); const [section, setSection] = useState('overview'); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [uploading, setUploading] = useState(false); const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const fileInputRef = useRef(null); const supabase = getSupabase();

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

  async function saveBusiness(event) {
    event.preventDefault(); if (!businessId || saving) return; setSaving(true); setNotice(''); setError('');
    try {
      const payload = { name: (business.name || '').trim(), description: business.description || '', phone: business.phone || '', email: business.email || '', website: business.website || '', address: business.address || '', city: business.city || '' };
      if (!payload.name) throw new Error('Business name is required.');
      const { data, error } = await supabase.from('businesses').update(payload).eq('id', businessId).select('id,name,description,phone,email,website,address,city').single();
      if (error) throw error; if (!data) throw new Error('No business record was updated.'); setBusiness(data); setNotice('✓ Business profile saved successfully.');
    } catch (err) { setError(`Profile could not be saved: ${err.message || 'Unknown error'}`); } finally { setSaving(false); }
  }

  async function saveKnowledge(event) {
    event.preventDefault(); if (!businessId || saving) return; setSaving(true); setNotice(''); setError('');
    try {
      const rows = [...Object.entries(knowledge), ['custom_knowledge', customText]].map(([key, value]) => ({ business_id: businessId, key, value: value || '' }));
      const { error } = await supabase.from('business_info').upsert(rows, { onConflict: 'business_id,key' });
      if (error) throw error; setNotice('✓ Knowledge saved successfully. The chatbot can now use this information.');
    } catch (err) { setError(`Knowledge could not be saved: ${err.message || 'Unknown error'}`); } finally { setSaving(false); }
  }

  function chooseFile() { setError(''); setNotice(''); fileInputRef.current?.click(); }
  async function uploadDocument(event) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file || !businessId || uploading) return;
    const allowed = ['application/pdf','text/plain','text/csv','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type)) { setError('Please upload a PDF, DOCX, TXT, or CSV file.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Maximum file size is 10 MB.'); return; }
    setUploading(true); setNotice(''); setError('');
    try {
      setNotice(`Reading ${file.name}...`);
      const extractedText = (await extractDocumentText(file)).replace(/\u0000/g, '').trim();
      if (!extractedText) throw new Error('No readable text was found in this document. Scanned/image-only PDFs are not supported yet.');
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_'); const path = `${businessId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('business-knowledge').upload(path, file, { contentType: file.type, upsert: false }); if (uploadError) throw uploadError;
      const { data, error: insertError } = await supabase.from('knowledge_documents').insert({ business_id: businessId, title: file.name.replace(/\.[^.]+$/, ''), file_name: file.name, file_type: file.type, storage_path: path, extracted_text: extractedText, status: 'ready' }).select('id,title,file_name,file_type,storage_path,status,created_at').single();
      if (insertError) { await supabase.storage.from('business-knowledge').remove([path]); throw insertError; }
      setDocuments(current => [data, ...current]); setNotice(`✓ ${file.name} processed successfully. The chatbot can now use its contents.`);
    } catch (err) { setError(`Document processing failed: ${err.message || 'Unknown error'}`); } finally { setUploading(false); }
  }

  async function deleteDocument(doc) { setError(''); setNotice(''); try { const { error: storageError } = await supabase.storage.from('business-knowledge').remove([doc.storage_path].filter(Boolean)); if (storageError) throw storageError; const { error } = await supabase.from('knowledge_documents').delete().eq('id', doc.id).eq('business_id', businessId); if (error) throw error; setDocuments(current => current.filter(item => item.id !== doc.id)); setNotice('✓ Document removed.'); } catch (err) { setError(`Document could not be removed: ${err.message || 'Unknown error'}`); } }
  async function signOut() { await supabase.auth.signOut(); onSignOut(); }

  const nav = [['overview', <BriefcaseBusiness size={17} />, 'Overview'], ['business', <Settings size={17} />, 'Business Profile'], ['knowledge', <BookOpen size={17} />, 'Knowledge Base'], ['services', <Wrench size={17} />, 'Services'], ['faqs', <HelpCircle size={17} />, 'FAQs'], ['conversations', <MessageSquare size={17} />, 'Conversations'], ['leads', <CircleUserRound size={17} />, 'Leads']];
  if (loading) return <main className="admin-page"><div className="loading-card">Loading your secure admin workspace...</div></main>;

  return <div className="admin-layout"><aside className="sidebar"><div className="side-brand"><div className="brand-icon"><Bot size={20} /></div><div><strong>AI Support</strong><span>Business Admin</span></div></div><nav>{nav.map(([key, icon, label]) => <button key={key} className={section === key ? 'active' : ''} onClick={() => { setSection(key); setNotice(''); setError(''); }}>{icon}{label}</button>)}</nav><div className="side-bottom"><button onClick={signOut}><LogOut size={17} /> Sign out</button><button onClick={() => { window.location.href = '/'; }}><Bot size={17} /> Public chatbot</button></div></aside>
    <main className="admin-main"><div className="topbar"><div><div className="eyebrow">Secure workspace</div><h1>{section === 'overview' ? 'Dashboard' : nav.find(x => x[0] === section)?.[2]}</h1></div><div className="user-chip">{session.user.email}</div></div>{error && <div className="error-box">{error}</div>}{notice && <div className="save-note">{notice}</div>}
      {section === 'overview' && <><div className="stats-grid">{[['Services', counts.services, Wrench], ['FAQs', counts.faqs, HelpCircle], ['Conversations', counts.conversations, MessageSquare], ['Leads', counts.leads, CircleUserRound]].map(([label, value, Icon]) => <div className="stat-card" key={label}><div className="stat-icon"><Icon size={19} /></div><div><strong>{value}</strong><span>{label}</span></div></div>)}</div><div className="panel"><h2>{business.name}</h2><p className="muted">{business.description || 'Add your business description from Business Profile.'}</p><p className="muted">Only an authenticated user with a matching business membership can access this workspace.</p></div></>}
      {section === 'business' && <form className="panel form-panel" onSubmit={saveBusiness}><h2>Business Profile</h2><p className="muted">These details are used by the support system as business knowledge.</p><div className="form-grid">{['name','phone','email','website','address','city'].map(key => <label key={key}><span>{key}</span><input value={business[key] || ''} onChange={e => setBusiness({ ...business, [key]: e.target.value })} required={key === 'name'} /></label>)}<label className="wide"><span>description</span><textarea rows="5" value={business.description || ''} onChange={e => setBusiness({ ...business, description: e.target.value })} /></label></div><button className="primary-btn" type="submit" disabled={saving}>{saving ? 'Saving profile...' : 'Save profile'}</button></form>}
      {section === 'knowledge' && <div className="knowledge-grid"><form className="panel form-panel" onSubmit={saveKnowledge}><h2>Custom Business Knowledge</h2><p className="muted">Add information the chatbot should know and use when answering customers.</p><div className="form-grid">{[['opening_hours','Opening hours'],['booking_policy','Booking policy'],['cancellation_policy','Cancellation policy'],['payment_methods','Payment methods'],['support_policy','Support policy']].map(([key,label]) => <label className="wide" key={key}><span>{label}</span><textarea rows="3" value={knowledge[key]} onChange={e => setKnowledge({ ...knowledge, [key]: e.target.value })} /></label>)}<label className="wide"><span>Custom knowledge / additional information</span><textarea rows="10" value={customText} onChange={e => setCustomText(e.target.value)} placeholder="Add detailed business information, products, services, policies, FAQs, special instructions, etc." /></label></div><button className="primary-btn" type="submit" disabled={saving}>{saving ? 'Saving knowledge...' : 'Save knowledge'}</button></form>
        <div className="panel"><h2>Business Documents</h2><p className="muted">Upload PDF, DOCX, TXT, or CSV files. Text is extracted before the file is marked ready.</p><button type="button" className="upload-box" onClick={chooseFile} disabled={uploading}><Upload size={22} /><strong>{uploading ? 'Processing...' : 'Choose document'}</strong><span>PDF, DOCX, TXT, CSV • max 10 MB</span></button><input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.csv,application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={uploadDocument} disabled={uploading} style={{ display: 'none' }} /><div className="document-list">{documents.length === 0 ? <p className="muted">No documents uploaded yet.</p> : documents.map(doc => <div className="document-item" key={doc.id}><FileText size={20} /><div><strong>{doc.file_name}</strong><span>{doc.status === 'ready' ? 'Text extracted and ready for chatbot' : 'Processing required'}</span></div><button type="button" onClick={() => deleteDocument(doc)}>Delete</button></div>)}</div></div></div>}
      {['services','faqs','conversations','leads'].includes(section) && <div className="panel"><h2>{nav.find(x => x[0] === section)?.[2]}</h2><p className="muted">This section is securely scoped to your assigned business. Management controls can be added without changing the public chatbot.</p></div>}
    </main></div>;
}

export default function AdminApp() { const [session, setSession] = useState(undefined); useEffect(() => { let mounted = true; const supabase = getSupabase(); supabase.auth.getSession().then(({ data }) => { if (mounted) setSession(data.session || null); }); const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { if (mounted) setSession(nextSession || null); }); return () => { mounted = false; listener.subscription.unsubscribe(); }; }, []); if (session === undefined) return <main className="admin-page"><div className="loading-card">Checking secure session...</div></main>; return session ? <AdminDashboard session={session} onSignOut={() => setSession(null)} /> : <Login onLoggedIn={setSession} />; }
