import React, { useEffect, useRef, useState } from 'react';
import { getSupabase } from './lib/supabase';
import { Bot, BriefcaseBusiness, CircleUserRound, FileText, HelpCircle, LogOut, MessageSquare, Settings, Upload, Wrench, BookOpen, Plus, ShieldCheck, Eye, EyeOff, X } from 'lucide-react';
import AccountSettings from './AccountSettings';
import SuperAdminBusinesses from './SuperAdminBusinesses';
import mammoth from 'mammoth/mammoth.browser';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const SUPER_ADMIN_USER_ID = '49149fcb-fbd5-4079-befd-3af7fd8e1725';
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
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [showPassword, setShowPassword] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  async function submit(event) { event.preventDefault(); setLoading(true); setError(''); try { const { data, error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password }); if (error) throw error; if (!data.session) throw new Error('Login did not create a session.'); onLoggedIn(data.session); } catch (err) { setError(err.message || 'Unable to sign in.'); } finally { setLoading(false); } }
  return <main className="admin-page login-page"><form className="auth-card login-card" onSubmit={submit}>
    <div className="auth-logo"><Bot size={23} /></div>
    <h1>Sign in</h1><p className="login-subtitle">Welcome back. Sign in to your admin dashboard.</p>
    <label><span>Email</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="Enter your email" required /></label>
    <label><span>Password</span><div className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" placeholder="Enter your password" required /><button type="button" className="password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
    <button className="primary-btn login-submit" type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
    {error && <div className="error-box">{error}</div>}
    <button className="back-link" type="button" onClick={() => { window.location.href = '/'; }}>← Back to chatbot</button>
  </form></main>;
}

function CreateBusiness({ session, onDone }) {
  const [form, setForm] = useState(emptyCreateBusiness); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  async function submit(event) { event.preventDefault(); setSaving(true); setError(''); setNotice(''); try { const { data: sessionData } = await getSupabase().auth.getSession(); const accessToken = sessionData.session?.access_token || session.access_token; const response = await fetch('/api/admin-create-business', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(form) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not create business.'); setForm(emptyCreateBusiness); setNotice(`✓ ${data.business.name} created. An invitation was sent to ${data.business.clientEmail}.`); if (onDone) onDone(); } catch (err) { setError(err.message || 'Could not create business.'); } finally { setSaving(false); } }
  return <div className="super-admin-page"><div className="panel super-admin-card"><div className="section-heading"><div><h2><ShieldCheck size={19} /> Create Business + Invite Client</h2><p className="muted">Create a separate business workspace and send the client their own Supabase invitation.</p></div></div>{error && <div className="error-box">{error}</div>}{notice && <div className="save-note">{notice}</div>}<form className="form-panel" onSubmit={submit}><div className="form-grid">{isSuperAdmin && section === 'business' && <label className="wide super-admin-business-selector"><span>Select business to manage</span><select value={businessId || ''} onChange={async e => { const id=e.target.value; setBusinessId(id); if(!id)return; const {data,error}=await supabase.from('businesses').select('id,name,description,phone,email,website,address,city').eq('id',id).single(); if(!error&&data)setBusiness(data); }}><option value="">Select a business</option>{availableBusinesses.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}<label><span>Business name *</span><input value={form.businessName} onChange={e => setForm({ ...form, businessName: e.target.value })} required /></label><label><span>Client name</span><input value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} /></label><label><span>Client email *</span><input type="email" value={form.clientEmail} onChange={e => setForm({ ...form, clientEmail: e.target.value })} required /></label><label><span>Phone</span><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label><label><span>City</span><input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></label><label className="wide"><span>Description</span><textarea rows="4" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label></div><div className="edit-actions"><button type="button" className="secondary-btn" onClick={() => { setForm(emptyCreateBusiness); setError(''); setNotice(''); }}>Clear</button><button className="primary-btn" type="submit" disabled={saving}><Plus size={16} />{saving ? 'Creating & inviting...' : 'Create Business + Invite Client'}</button></div></form></div></div>;
}

function AdminDashboard({ session, onSignOut }) {
  const [businessId, setBusinessId] = useState(null); const [business, setBusiness] = useState(emptyBusiness); const [knowledge, setKnowledge] = useState(emptyKnowledge); const [documents, setDocuments] = useState([]); const [customText, setCustomText] = useState('');
  const [counts, setCounts] = useState({ services: 0, faqs: 0, conversations: 0, leads: 0 }); const [availableBusinesses, setAvailableBusinesses] = useState([]); const [showAllDocuments, setShowAllDocuments] = useState(false); const [section, setSection] = useState('overview'); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [uploading, setUploading] = useState(false); const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const fileInputRef = useRef(null); const supabase = getSupabase();
  const isSuperAdmin = session.user.id === SUPER_ADMIN_USER_ID;
  useEffect(() => { loadAdmin(); }, []);
  async function loadAdmin() {
    setLoading(true); setError('');
    try {
      if (isSuperAdmin) {
        const { data: businessList, error: businessListError } = await supabase.from('businesses').select('id,name').order('name');
        if (businessListError) throw businessListError;
        setAvailableBusinesses(businessList || []);
        const selectedId = businessId || businessList?.[0]?.id || null;
        setBusinessId(selectedId);
        if (selectedId) {
          const [businessResult, infoResult, docsResult, services, faqs, conversations, leads] = await Promise.all([
            supabase.from('businesses').select('id,name,description,phone,email,website,address,city').eq('id', selectedId).single(),
            supabase.from('business_info').select('key,value').eq('business_id', selectedId),
            supabase.from('knowledge_documents').select('id,title,file_name,file_type,storage_path,status,created_at').eq('business_id', selectedId).order('created_at', { ascending: false }),
            supabase.from('services').select('id', { count: 'exact', head: true }).eq('business_id', selectedId),
            supabase.from('faqs').select('id', { count: 'exact', head: true }).eq('business_id', selectedId),
            supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('business_id', selectedId),
            supabase.from('leads').select('id', { count: 'exact', head: true }).eq('business_id', selectedId)
          ]);
          const failed = [businessResult, infoResult, docsResult, services, faqs, conversations, leads].find(result => result.error);
          if (failed?.error) throw failed.error;
          setBusiness(businessResult.data || emptyBusiness);
          const info = Object.fromEntries((infoResult.data || []).map(row => [row.key, row.value]));
          setKnowledge({ opening_hours: info.opening_hours || '', booking_policy: info.booking_policy || '', cancellation_policy: info.cancellation_policy || '', payment_methods: info.payment_methods || '', support_policy: info.support_policy || '' });
          setCustomText(info.custom_knowledge || ''); setDocuments(docsResult.data || []);
          setCounts({ services: services.count || 0, faqs: faqs.count || 0, conversations: conversations.count || 0, leads: leads.count || 0 });
        }
        return;
        /*
        const [services, faqs, conversations, leads] = await Promise.all([
          supabase.from('services').select('id', { count: 'exact', head: true }),
          supabase.from('faqs').select('id', { count: 'exact', head: true }),
          supabase.from('conversations').select('id', { count: 'exact', head: true }),
          supabase.from('leads').select('id', { count: 'exact', head: true }).is('business_id', null)
        ]);
        const failed = [services, faqs, conversations, leads].find(result => result.error);
        if (failed?.error) throw failed.error;
        setBusiness(emptyBusiness);
        setCounts({ services: services.count || 0, faqs: faqs.count || 0, conversations: conversations.count || 0, leads: leads.count || 0 });
        setKnowledge(emptyKnowledge); setCustomText(''); setDocuments([]);
        return; */
      }
      const { data: membership, error: membershipError } = await supabase.from('business_admins').select('business_id, role').eq('user_id', session.user.id).maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership?.business_id) throw new Error('Your account is not assigned to a business yet.');
      setBusinessId(membership.business_id);
      const [businessResult, services, faqs, conversations, leads, infoResult, docsResult] = await Promise.all([
        supabase.from('businesses').select('id,name,description,phone,email,website,address,city').eq('id', membership.business_id).single(),
        supabase.from('services').select('id', { count: 'exact', head: true }).eq('business_id', membership.business_id),
        supabase.from('faqs').select('id', { count: 'exact', head: true }).eq('business_id', membership.business_id),
        supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('business_id', membership.business_id),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('business_id', membership.business_id),
        supabase.from('business_info').select('key,value').eq('business_id', membership.business_id),
        supabase.from('knowledge_documents').select('id,title,file_name,file_type,storage_path,status,created_at').eq('business_id', membership.business_id).order('created_at', { ascending: false })
      ]);
      if (businessResult.error) throw businessResult.error;
      for (const result of [services, faqs, conversations, leads, infoResult, docsResult]) if (result.error) throw result.error;
      setBusiness(businessResult.data || emptyBusiness);
      setCounts({ services: services.count || 0, faqs: faqs.count || 0, conversations: conversations.count || 0, leads: leads.count || 0 });
      const info = Object.fromEntries((infoResult.data || []).map(row => [row.key, row.value]));
      setKnowledge({ opening_hours: info.opening_hours || '', booking_policy: info.booking_policy || '', cancellation_policy: info.cancellation_policy || '', payment_methods: info.payment_methods || '', support_policy: info.support_policy || '' });
      setCustomText(info.custom_knowledge || ''); setDocuments(docsResult.data || []);
    } catch (err) {
      console.error('Admin dashboard load failed:', err);
      setError(err.message || 'Could not load the admin dashboard.');
    } finally { setLoading(false); }
  }
  async function saveBusiness(event) { event.preventDefault(); if (!businessId || saving) return; setSaving(true); setNotice(''); setError(''); try { const payload = { name: (business.name || '').trim(), description: business.description || '', phone: business.phone || '', email: business.email || '', website: business.website || '', address: business.address || '', city: business.city || '' }; if (!payload.name) throw new Error('Business name is required.'); const { data, error } = await supabase.from('businesses').update(payload).eq('id', businessId).select('id,name,description,phone,email,website,address,city').single(); if (error) throw error; if (!data) throw new Error('No business record was updated.'); setBusiness(data); setNotice('✓ Business profile saved successfully.'); } catch (err) { setError(`Profile could not be saved: ${err.message || 'Unknown error'}`); } finally { setSaving(false); } }
  async function saveKnowledge(event) { event.preventDefault(); if (!businessId || saving) return; setSaving(true); setNotice(''); setError(''); try { const rows = [...Object.entries(knowledge), ['custom_knowledge', customText]].map(([key, value]) => ({ business_id: businessId, key, value: value || '' })); const { error } = await supabase.from('business_info').upsert(rows, { onConflict: 'business_id,key' }); if (error) throw error; setNotice('✓ Knowledge saved successfully. The chatbot can now use this information.'); } catch (err) { setError(`Knowledge could not be saved: ${err.message || 'Unknown error'}`); } finally { setSaving(false); } }
  function chooseFile() { setError(''); setNotice(''); fileInputRef.current?.click(); }
  async function uploadDocument(event) { const file = event.target.files?.[0]; event.target.value = ''; if (!file || !businessId || uploading) return; const allowed = ['application/pdf','text/plain','text/csv','application/vnd.openxmlformats-officedocument.wordprocessingml.document']; if (!allowed.includes(file.type)) { setError('Please upload a PDF, DOCX, TXT, or CSV file.'); return; } if (file.size > 10 * 1024 * 1024) { setError('Maximum file size is 10 MB.'); return; } setUploading(true); setNotice(''); setError(''); try { setNotice(`Reading ${file.name}...`); const extractedText = (await extractDocumentText(file)).replace(/\u0000/g, '').trim(); if (!extractedText) throw new Error('No readable text was found in this document. Scanned/image-only PDFs are not supported yet.'); const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_'); const path = `${businessId}/${crypto.randomUUID()}-${safeName}`; const { error: uploadError } = await supabase.storage.from('business-knowledge').upload(path, file, { contentType: file.type, upsert: false }); if (uploadError) throw uploadError; const { data, error: insertError } = await supabase.from('knowledge_documents').insert({ business_id: businessId, title: file.name.replace(/\.[^.]+$/, ''), file_name: file.name, file_type: file.type, storage_path: path, extracted_text: extractedText, status: 'ready' }).select('id,title,file_name,file_type,storage_path,status,created_at').single(); if (insertError) { await supabase.storage.from('business-knowledge').remove([path]); throw insertError; } setDocuments(current => [data, ...current]); setNotice(`✓ ${file.name} processed successfully. The chatbot can now use its contents.`); } catch (err) { setError(`Document processing failed: ${err.message || 'Unknown error'}`); } finally { setUploading(false); } }
  async function deleteDocument(doc) { setError(''); setNotice(''); try { const { error: storageError } = await supabase.storage.from('business-knowledge').remove([doc.storage_path].filter(Boolean)); if (storageError) throw storageError; const { error } = await supabase.from('knowledge_documents').delete().eq('id', doc.id).eq('business_id', businessId); if (error) throw error; setDocuments(current => current.filter(item => item.id !== doc.id)); setNotice('✓ Document removed.'); } catch (err) { setError(`Document could not be removed: ${err.message || 'Unknown error'}`); } }
  async function deleteLead(leadId) {
    if (!businessId || !leadId) return;
    try {
      const { error } = await supabase.from('leads').delete().eq('id', leadId).eq('business_id', businessId);
      if (error) throw error;
      setCounts(current => ({ ...current, leads: Math.max(0, current.leads - 1) }));
      setNotice('✓ Lead deleted.');
      setError('');
    } catch (err) {
      setError(`Lead could not be deleted: ${err.message || 'Unknown error'}`);
    }
  }
  async function signOut() { await supabase.auth.signOut(); onSignOut(); }
  const nav = [['overview', <BriefcaseBusiness size={17} />, 'Overview'], ['business', <Settings size={17} />, 'Business Profile'], ['knowledge', <BookOpen size={17} />, 'Knowledge Base'], ['services', <Wrench size={17} />, 'Services'], ['faqs', <HelpCircle size={17} />, 'FAQs'], ['conversations', <MessageSquare size={17} />, 'Conversations'], ['leads', <CircleUserRound size={17} />, 'Leads'], ['account-settings', <ShieldCheck size={17} />, 'Account Settings']];
  if (isSuperAdmin) nav.splice(1, 0, ['create-business', <Plus size={17} />, 'Create Business']);
  if (loading) return <main className="admin-page"><div className="loading-card">Loading your secure admin workspace...</div></main>;
  return <div className="admin-layout"><aside className="sidebar"><div className="side-brand"><div className="brand-icon"><Bot size={20} /></div><div><strong>AI Support</strong><span>{isSuperAdmin ? 'Super Admin' : 'Business Admin'}</span></div></div><nav>{nav.map(([key, icon, label]) => <button key={key} className={section === key ? 'active' : ''} onClick={() => { setSection(key); setNotice(''); setError(''); }}>{icon}{label}</button>)}{isSuperAdmin && <SuperAdminBusinesses />}</nav><div className="side-bottom"><button onClick={signOut}><LogOut size={17} /> Sign out</button><button onClick={() => { window.location.href = '/'; }}><Bot size={17} /> Public chatbot</button></div></aside><main className="admin-main"><div className="topbar"><div><div className="eyebrow">{isSuperAdmin ? 'Platform control' : 'Secure workspace'}</div><h1>{section === 'overview' ? 'Dashboard' : nav.find(x => x[0] === section)?.[2]}</h1></div><div className="user-chip">{session.user.email}</div></div>{error && <div className="error-box">{error}</div>}{notice && <div className="save-note">{notice}</div>}{section === 'create-business' && isSuperAdmin && <CreateBusiness session={session} onDone={() => setSection('overview')} />}{section === 'account-settings' && <AccountSettings session={session} setError={setError} setNotice={setNotice} />}{section === 'overview' && <><div className="stats-grid">{[['Services', counts.services, Wrench], ['FAQs', counts.faqs, HelpCircle], ['Conversations', counts.conversations, MessageSquare], ['Leads', counts.leads, CircleUserRound]].map(([label, value, Icon]) => <div className="stat-card" key={label}><div className="stat-icon"><Icon size={18} /></div><div><strong>{value}</strong><span>{label}</span></div></div>)}</div><div className="panel"><div className="panel-heading"><div><h2>{business.name || 'Business'}</h2><p>Manage your chatbot business workspace and customer support data.</p></div></div><p className="muted">Your chatbot is connected to this business workspace.</p></div></>}{section === 'business' && <form className="panel form-panel" onSubmit={saveBusiness}><div className="section-heading"><div><h2>Business Profile</h2><p className="muted">Keep your public business information accurate.</p></div></div><div className="form-grid"><label><span>Business name *</span><input value={business.name} onChange={e => setBusiness({ ...business, name: e.target.value })} required /></label><label className="contact-highlight"><span>Email <small>Shown to customers for contact</small></span><input type="email" value={business.email || ''} onChange={e => setBusiness({ ...business, email: e.target.value })} /></label><label className="contact-highlight"><span>Phone <small>Shown to customers for contact</small></span><input value={business.phone || ''} onChange={e => setBusiness({ ...business, phone: e.target.value })} /></label><label className="contact-highlight"><span>Website <small>Shown to customers for contact</small></span><input value={business.website || ''} onChange={e => setBusiness({ ...business, website: e.target.value })} /></label><label><span>Address</span><input value={business.address || ''} onChange={e => setBusiness({ ...business, address: e.target.value })} /></label><label><span>City</span><input value={business.city || ''} onChange={e => setBusiness({ ...business, city: e.target.value })} /></label><label className="wide"><span>Description</span><textarea rows="5" value={business.description || ''} onChange={e => setBusiness({ ...business, description: e.target.value })} /></label></div><div className="edit-actions"><button className="primary-btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button></div></form>}{section === 'knowledge' && <div className="knowledge-grid"><form className="panel form-panel" onSubmit={saveKnowledge}><h2>Custom Business Knowledge</h2><p className="muted">Add information the chatbot should know and use when answering customers.</p><div className="form-grid"><label className="wide"><span>Opening hours</span><textarea rows="3" value={knowledge.opening_hours} onChange={e => setKnowledge({ ...knowledge, opening_hours: e.target.value })} /></label><label className="wide"><span>Business Policy</span><textarea rows="3" value={knowledge.booking_policy} onChange={e => setKnowledge({ ...knowledge, booking_policy: e.target.value })} /></label><label className="wide"><span>Services Cancellation policy</span><textarea rows="3" value={knowledge.cancellation_policy} onChange={e => setKnowledge({ ...knowledge, cancellation_policy: e.target.value })} /></label><label className="wide"><span>Payment Methods <small>(if you handle payments)</small></span><textarea rows="3" value={knowledge.payment_methods} onChange={e => setKnowledge({ ...knowledge, payment_methods: e.target.value })} /></label><label className="wide"><span>Customer Support policy</span><textarea rows="3" value={knowledge.support_policy} onChange={e => setKnowledge({ ...knowledge, support_policy: e.target.value })} /></label><label className="wide"><span>Custom knowledge</span><textarea rows="7" value={customText} onChange={e => setCustomText(e.target.value)} placeholder="Example: Our business is closed every Sunday..." /></label></div><button className="primary-btn" type="submit" disabled={saving}>{saving ? 'Saving knowledge...' : 'Save knowledge'}</button></form><div className="panel"><h2>Business Documents</h2><p className="muted">Upload PDF, DOCX, TXT, or CSV files. Text is extracted before the file is marked ready.</p><input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/csv" onChange={uploadDocument} hidden /><button className="upload-box" type="button" onClick={chooseFile} disabled={uploading}><Upload size={24} /><strong>{uploading ? 'Processing document...' : 'Upload a business document'}</strong><span>PDF, DOCX, TXT or CSV · Maximum 10 MB</span></button>{documents.length === 0 ? <div className="empty-card" style={{ marginTop: 18 }}>No business documents uploaded yet.</div> : <><div className="document-list">{(showAllDocuments ? documents : documents.slice(0, 3)).map(doc => <div className="document-item" key={doc.id}><FileText size={18} /><div className="document-name"><strong title={doc.title || doc.file_name}>{doc.title || doc.file_name}</strong><span>{doc.status} · {doc.file_name}</span></div><button type="button" onClick={() => deleteDocument(doc)}>Delete</button></div>)}</div>{documents.length > 3 && !showAllDocuments && <button type="button" className="secondary-btn documents-view-all" onClick={() => setShowAllDocuments(true)}>View All ({documents.length})</button>}{showAllDocuments && documents.length > 3 && <button type="button" className="secondary-btn documents-close" onClick={() => setShowAllDocuments(false)}><X size={15} /> Close</button>}</>}</div></div>}{section === 'services' && <DataSection title="Services" table="services" fields={['name','description','price','currency','availability','status']} businessId={businessId} />}{section === 'faqs' && <DataSection title="FAQs" table="faqs" fields={['question','answer','category','status']} businessId={businessId} />}{section === 'conversations' && <div className="panel"><div className="section-heading"><div><h2>Conversations</h2><p className="muted">Conversation messages are not stored. They exist only during the customer's active browser session and disappear when the session ends.</p></div></div><div className="retention-notice"><MessageSquare size={18} /><div><strong>Privacy-first chat storage</strong><span>Chat messages are never saved to the database. Only contact requests submitted through the Contact form are stored as leads for 7 days.</span></div></div></div>}{section === 'leads' && <LeadsSection businessId={businessId} onDelete={deleteLead} isSuperAdmin={isSuperAdmin} />}</main></div>;
}

function LeadsSection({ businessId, onDelete, isSuperAdmin }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabase();
  useEffect(() => {
    (async () => {
      setLoading(true);
      let query = supabase.from('leads').select('id,business_id,name,email,contact,subject,source,created_at').order('created_at', { ascending: false });
      query = isSuperAdmin ? query.is('business_id', null) : query.eq('business_id', businessId);
      const { data, error } = await query;
      if (error) {
        console.error('Lead load error:', error);
        setRows([]);
      } else {
        setRows(data || []);
      }
      setLoading(false);
    })();
  }, [businessId, isSuperAdmin]);
  async function deletePlatformLead(leadId) {
    if (!window.confirm('Delete this platform lead?')) return;
    const { error } = await supabase.from('leads').delete().eq('id', leadId).is('business_id', null);
    if (!error) setRows(current => current.filter(item => item.id !== leadId));
  }
  if (loading) return <div className="loading-card">Loading leads...</div>;
  return <div className="panel"><div className="section-heading"><div><h2>{isSuperAdmin ? 'Platform Leads' : 'Leads'}</h2><p className="muted">{isSuperAdmin ? 'Customer requests submitted through the platform contact form. Leads are automatically removed after 7 days.' : 'Customer contact requests. Leads are automatically removed after 7 days.'}</p></div></div>{rows.length === 0 ? <div className="empty-card">No leads found.</div> : <div className="table-wrap"><table><thead><tr><th>Customer Name</th><th>Email</th><th>WhatsApp</th><th>Subject</th><th>Source</th><th>Created At</th><th aria-label="Delete"></th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.name || ''}</td><td>{row.email || ''}</td><td>{row.contact || ''}</td><td>{row.subject || ''}</td><td>{row.source === 'platform_contact' ? 'Platform Contact' : 'Chatbot'}</td><td>{row.created_at ? new Date(row.created_at).toLocaleString() : ''}</td><td><button type="button" className="lead-delete-btn" onClick={() => { if (isSuperAdmin) deletePlatformLead(row.id); else if (window.confirm('Delete this lead?')) { onDelete(row.id); setRows(current => current.filter(item => item.id !== row.id)); } }} aria-label="Delete lead" title="Delete lead">×</button></td></tr>)}</tbody></table></div>}</div>;
}


function DataSection({ title, table, fields, businessId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(table === 'services'
    ? { name: '', description: '', price: '', currency: 'PKR', availability: '', status: 'active' }
    : { question: '', answer: '', category: '', status: 'active' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const supabase = getSupabase();

  async function loadRows() {
    setLoading(true);
    const { data } = await supabase.from(table).select(fields.join(',')).eq('business_id', businessId).order('created_at', { ascending: false });
    setRows(data || []);
    setLoading(false);
  }
  useEffect(() => { loadRows(); }, [table, businessId]);

  function openForm() {
    setError('');
    setEditingId(null);
    setForm(table === 'services'
      ? { name: '', description: '', price: '', currency: 'PKR', availability: '', status: 'active' }
      : { question: '', answer: '', category: '', status: 'active' });
    setFormOpen(true);
  }

  function editRow(row) {
    setError('');
    setEditingId(row.id);
    if (table === 'services') {
      setForm({
        name: row.name || '',
        description: row.description || '',
        price: row.price ?? '',
        currency: row.currency || 'PKR',
        availability: row.availability || '',
        status: row.status || 'active'
      });
    } else {
      setForm({
        question: row.question || '',
        answer: row.answer || '',
        category: row.category || '',
        status: row.status || 'active'
      });
    }
    setFormOpen(true);
  }

  async function deleteRow(row) {
    if (!row?.id || !window.confirm(`Delete this ${table === 'services' ? 'service' : 'FAQ'}?`)) return;
    setError('');
    try {
      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq('id', row.id)
        .eq('business_id', businessId);
      if (deleteError) throw deleteError;
      setRows(current => current.filter(item => item.id !== row.id));
    } catch (err) {
      setError(err.message || `Could not delete this ${title.toLowerCase().slice(0, -1)}.`);
    }
  }

  async function saveRow(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError('');
    try {
      const payload = { business_id: businessId, ...form };
      if (table === 'services') payload.price = form.price === '' ? null : Number(form.price);

      if (editingId) {
        const { error: updateError } = await supabase
          .from(table)
          .update(payload)
          .eq('id', editingId)
          .eq('business_id', businessId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from(table).insert(payload);
        if (insertError) throw insertError;
      }

      setFormOpen(false);
      setEditingId(null);
      await loadRows();
    } catch (err) {
      setError(err.message || `Could not add ${title.toLowerCase()}.`);
    } finally { setSaving(false); }
  }

  if (loading) return <div className="loading-card">Loading {title.toLowerCase()}...</div>;
  const isServices = table === 'services';
  return <div className="panel">
    <div className="section-heading"><div><h2>{title}</h2><p className="muted">Business-specific {title.toLowerCase()}.</p></div><button type="button" className="primary-btn" onClick={openForm}>+ Add {isServices ? 'Service' : 'FAQ'}</button></div>
    {error && <div className="error-box">{error}</div>}
    {formOpen && <form className="form-panel add-data-form" onSubmit={saveRow}>
      {isServices ? <div className="form-grid">
        <label><span>Service name *</span><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></label>
        <label><span>Price</span><input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="e.g. 5000" /></label>
        <label><span>Currency</span><input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} /></label>
        <label><span>Availability</span><input value={form.availability} onChange={e => setForm({ ...form, availability: e.target.value })} placeholder="e.g. Mon-Sat, 9 AM-6 PM" /></label>
        <label className="wide"><span>Description</span><textarea rows="4" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
      </div> : <div className="form-grid">
        <label className="wide"><span>Question *</span><input value={form.question} onChange={e => setForm({ ...form, question: e.target.value })} required /></label>
        <label className="wide"><span>Answer *</span><textarea rows="5" value={form.answer} onChange={e => setForm({ ...form, answer: e.target.value })} required /></label>
        <label><span>Category</span><input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></label>
      </div>}
      <div className="edit-actions"><button type="button" className="secondary-btn" onClick={() => { setFormOpen(false); setEditingId(null); }}>Cancel</button><button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Saving...' : (editingId ? `Save ${isServices ? 'Service' : 'FAQ'}` : `Add ${isServices ? 'Service' : 'FAQ'}`)}</button></div>
    </form>}
    {rows.length === 0 ? <div className="empty-card">No {title.toLowerCase()} found.</div> : <div className="table-wrap"><table><thead><tr>{fields.map(field => <th key={field}>{field.replaceAll('_',' ')}</th>)}<th>Actions</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || index}>{fields.map(field => <td key={field}>{typeof row[field] === 'object' ? JSON.stringify(row[field]) : String(row[field] ?? '')}</td>)}<td><div className="data-row-actions" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><button type="button" className="data-edit-btn" onClick={() => editRow(row)} style={{ border: '1px solid #c7e3f7', borderRadius: 8, padding: '6px 10px', background: '#eef8ff', color: '#4aa3df', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Edit</button><button type="button" className="data-delete-btn" onClick={() => deleteRow(row)} style={{ border: '1px solid #c7e3f7', borderRadius: 8, padding: '6px 10px', background: '#eef8ff', color: '#4aa3df', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Delete</button></div></td></tr>)}</tbody></table></div>}
  </div>;
}

export default function AdminApp() { const [session, setSession] = useState(null); const [loading, setLoading] = useState(true); const supabase = getSupabase(); useEffect(() => { let mounted = true; supabase.auth.getSession().then(({ data }) => { if (mounted) { setSession(data.session); setLoading(false); } }); const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession)); return () => { mounted = false; listener.subscription.unsubscribe(); }; }, []); if (loading) return <main className="admin-page"><div className="loading-card">Loading secure admin access...</div></main>; if (!session) return <Login onLoggedIn={setSession} />; return <AdminDashboard session={session} onSignOut={() => setSession(null)} />; }
