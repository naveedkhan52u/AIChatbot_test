import React, { useEffect, useState } from 'react';
import { getSupabase } from './lib/supabase';
import { Bot, BriefcaseBusiness, CircleUserRound, FileText, HelpCircle, LogOut, MessageSquare, Settings, Wrench } from 'lucide-react';

const emptyBusiness = { name: '', description: '', phone: '', email: '', website: '', address: '', city: '' };

function Login({ onLoggedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setLoading(true); setError('');
    try {
      const { data, error: signInError } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) throw signInError;
      if (!data.session) throw new Error('Login did not create a session.');
      onLoggedIn(data.session);
    } catch (err) {
      setError(err.message || 'Unable to sign in.');
    } finally { setLoading(false); }
  }

  return <main className="admin-page"><form className="auth-card" onSubmit={submit}>
    <div className="auth-logo"><Bot size={24} /></div>
    <h1>Admin Login</h1><p>Sign in with an authorized business admin account.</p>
    <label><span>Email</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label>
    <label><span>Password</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>
    <button className="primary-btn" type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
    {error && <div className="error-box">{error}</div>}
    <button className="back-link" type="button" onClick={() => { window.location.href = '/'; }}>Back to chatbot</button>
  </form></main>;
}

function AdminDashboard({ session, onSignOut }) {
  const [businessId, setBusinessId] = useState(null);
  const [business, setBusiness] = useState(emptyBusiness);
  const [counts, setCounts] = useState({ services: 0, faqs: 0, conversations: 0, leads: 0 });
  const [section, setSection] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const supabase = getSupabase();

  useEffect(() => { loadAdmin(); }, []);

  async function loadAdmin() {
    setLoading(true); setError('');
    try {
      const { data: membership, error: membershipError } = await supabase.from('business_admins').select('business_id, role').eq('user_id', session.user.id).maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership?.business_id) throw new Error('Your account is not assigned to a business yet.');
      setBusinessId(membership.business_id);

      const [businessResult, services, faqs, conversations, leads] = await Promise.all([
        supabase.from('businesses').select('id,name,description,phone,email,website,address,city').eq('id', membership.business_id).single(),
        supabase.from('services').select('id', { count: 'exact', head: true }).eq('business_id', membership.business_id),
        supabase.from('faqs').select('id', { count: 'exact', head: true }).eq('business_id', membership.business_id),
        supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('business_id', membership.business_id),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('business_id', membership.business_id),
      ]);
      if (businessResult.error) throw businessResult.error;
      for (const result of [services, faqs, conversations, leads]) if (result.error) throw result.error;
      setBusiness(businessResult.data || emptyBusiness);
      setCounts({ services: services.count || 0, faqs: faqs.count || 0, conversations: conversations.count || 0, leads: leads.count || 0 });
    } catch (err) { setError(err.message || 'Could not load the admin dashboard.'); }
    finally { setLoading(false); }
  }

  async function saveBusiness(event) {
    event.preventDefault();
    if (!businessId) return;
    setSaving(true); setNotice(''); setError('');
    try {
      const { data, error: updateError } = await supabase.from('businesses').update({ name: business.name, description: business.description, phone: business.phone, email: business.email, website: business.website, address: business.address, city: business.city }).eq('id', businessId).select('id,name,description,phone,email,website,address,city').single();
      if (updateError) throw updateError;
      setBusiness(data); setNotice('Business profile saved.');
    } catch (err) { setError(err.message || 'Could not save the business profile.'); }
    finally { setSaving(false); }
  }

  async function signOut() { await supabase.auth.signOut(); onSignOut(); }

  const nav = [
    ['overview', <BriefcaseBusiness size={17} />, 'Overview'],
    ['business', <Settings size={17} />, 'Business Profile'],
    ['services', <Wrench size={17} />, 'Services'],
    ['faqs', <HelpCircle size={17} />, 'FAQs'],
    ['conversations', <MessageSquare size={17} />, 'Conversations'],
    ['leads', <CircleUserRound size={17} />, 'Leads'],
  ];

  if (loading) return <main className="admin-page"><div className="loading-card">Loading your secure admin workspace...</div></main>;

  return <div className="admin-layout">
    <aside className="sidebar"><div className="side-brand"><div className="brand-icon"><Bot size={20} /></div><div><strong>AI Support</strong><span>Business Admin</span></div></div>
      <nav>{nav.map(([key, icon, label]) => <button key={key} className={section === key ? 'active' : ''} onClick={() => { setSection(key); setNotice(''); setError(''); }}>{icon}{label}</button>)}</nav>
      <div className="side-bottom"><button onClick={signOut}><LogOut size={17} /> Sign out</button><button onClick={() => { window.location.href = '/'; }}><Bot size={17} /> Public chatbot</button></div>
    </aside>
    <main className="admin-main"><div className="topbar"><div><div className="eyebrow">Secure workspace</div><h1>{section === 'overview' ? 'Dashboard' : nav.find(x => x[0] === section)?.[2]}</h1></div><div className="user-chip">{session.user.email}</div></div>
      {error && <div className="error-box">{error}</div>}
      {notice && <div className="save-note">{notice}</div>}
      {section === 'overview' && <><div className="stats-grid">{[['Services', counts.services, Wrench], ['FAQs', counts.faqs, HelpCircle], ['Conversations', counts.conversations, MessageSquare], ['Leads', counts.leads, CircleUserRound]].map(([label, value, Icon]) => <div className="stat-card" key={label}><div className="stat-icon"><Icon size={19} /></div><div><strong>{value}</strong><span>{label}</span></div></div>)}</div><div className="panel"><h2>{business.name}</h2><p className="muted">{business.description || 'Add your business description from Business Profile.'}</p><p className="muted">Only an authenticated user with a matching business membership can access this workspace.</p></div></>}
      {section === 'business' && <form className="panel form-panel" onSubmit={saveBusiness}><h2>Business Profile</h2><p className="muted">These details are used by the support system as business knowledge.</p><div className="form-grid">
        {['name','phone','email','website','address','city'].map(key => <label key={key}><span>{key}</span><input value={business[key] || ''} onChange={e => setBusiness({ ...business, [key]: e.target.value })} required={key === 'name'} /></label>)}
        <label className="wide"><span>description</span><textarea rows="5" value={business.description || ''} onChange={e => setBusiness({ ...business, description: e.target.value })} /></label>
      </div><button className="primary-btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button></form>}
      {['services','faqs','conversations','leads'].includes(section) && <div className="panel"><h2>{nav.find(x => x[0] === section)?.[2]}</h2><p className="muted">This section is securely scoped to your assigned business. The next management step can be added without changing the public chatbot.</p></div>}
    </main>
  </div>;
}

export default function AdminApp() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    let mounted = true;
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => { if (mounted) setSession(data.session || null); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { if (mounted) setSession(nextSession || null); });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);
  if (session === undefined) return <main className="admin-page"><div className="loading-card">Checking secure session...</div></main>;
  return session ? <AdminDashboard session={session} onSignOut={() => setSession(null)} /> : <Login onLoggedIn={setSession} />;
}
