import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Building2, Trash2, X, RefreshCw, ShieldCheck } from 'lucide-react';
import { getSupabase } from './lib/supabase';

const SUPER_ADMIN_EMAIL = 'naveedkhanu52@gmail.com';

export default function SuperAdminBusinesses() {
  const [session, setSession] = useState(null);
  const [buttonHost, setButtonHost] = useState(null);
  const [open, setOpen] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.email?.toLowerCase() !== SUPER_ADMIN_EMAIL) return undefined;
    const nav = document.querySelector('.sidebar nav');
    if (!nav) return undefined;
    const host = document.createElement('div');
    nav.appendChild(host);
    setButtonHost(host);
    return () => host.remove();
  }, [session]);

  async function loadBusinesses() {
    setLoading(true); setError('');
    try {
      const supabase = getSupabase();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const response = await fetch('/api/admin-businesses', { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load businesses.');
      setBusinesses(data.businesses || []);
    } catch (err) { setError(err.message || 'Could not load businesses.'); }
    finally { setLoading(false); }
  }

  async function openBusinesses() { setOpen(true); await loadBusinesses(); }

  async function deleteBusiness(item) {
    const confirmed = window.confirm(`Delete ${item.businessName} and remove ${item.ownerEmail}'s access? This permanently deletes the business data, documents, conversations, FAQs, services and leads.`);
    if (!confirmed) return;
    setDeleting(item.businessId); setError('');
    try {
      const supabase = getSupabase();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const response = await fetch(`/api/admin-businesses?businessId=${encodeURIComponent(item.businessId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not delete business.');
      setBusinesses(current => current.filter(business => business.businessId !== item.businessId));
    } catch (err) { setError(err.message || 'Could not delete business.'); }
    finally { setDeleting(null); }
  }

  if (!buttonHost || session?.user?.email?.toLowerCase() !== SUPER_ADMIN_EMAIL) return null;

  const button = createPortal(
    <button type="button" onClick={openBusinesses} className="super-admin-nav-button"><Building2 size={17} /> Businesses</button>,
    buttonHost
  );

  const modal = open ? createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(15,23,42,.48)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div style={{ width: 'min(980px, 100%)', maxHeight: '88vh', overflow: 'auto', background: '#fff', borderRadius: 18, boxShadow: '0 30px 90px rgba(0,0,0,.25)' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 15, padding: '18px 22px', background: '#fff', borderBottom: '1px solid #e8ecf2' }}>
          <div><div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#172033' }}><ShieldCheck size={19} /> Created Businesses</div><div style={{ color: '#7a8698', fontSize: 12, marginTop: 4 }}>Business owners invited through your Super Admin dashboard.</div></div>
          <div style={{ display: 'flex', gap: 7 }}><button type="button" onClick={loadBusinesses} disabled={loading} style={{ border: '1px solid #dfe5ee', background: '#fff', borderRadius: 9, padding: 8, color: '#526077' }} title="Refresh"><RefreshCw size={16} /></button><button type="button" onClick={() => setOpen(false)} style={{ border: 0, background: '#eef2f7', borderRadius: 9, padding: 8, color: '#526077' }} title="Close"><X size={18} /></button></div>
        </div>
        <div style={{ padding: 22 }}>
          {error && <div className="error-box" style={{ marginTop: 0, marginBottom: 14 }}>{error}</div>}
          {loading ? <div className="loading-card">Loading businesses...</div> : businesses.length === 0 ? <div className="empty-card">No created businesses found.</div> : <div style={{ display: 'grid', gap: 10 }}>{businesses.map(item => <div key={`${item.businessId}-${item.ownerEmail}`} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.5fr auto', alignItems: 'center', gap: 15, padding: 15, border: '1px solid #e4e9f1', borderRadius: 13, background: '#fff' }}><div><div style={{ fontSize: 11, color: '#8a95a7', marginBottom: 4 }}>Owner Name</div><strong>{item.ownerName || 'Not provided'}</strong></div><div><div style={{ fontSize: 11, color: '#8a95a7', marginBottom: 4 }}>Business Name</div><strong>{item.businessName}</strong></div><div><div style={{ fontSize: 11, color: '#8a95a7', marginBottom: 4 }}>Email</div><span style={{ color: '#536177', fontSize: 13, overflowWrap: 'anywhere' }}>{item.ownerEmail}</span></div><button type="button" disabled={deleting === item.businessId} onClick={() => deleteBusiness(item)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #ead4d4', background: '#fff', color: '#a44747', borderRadius: 9, padding: '8px 10px', cursor: deleting === item.businessId ? 'wait' : 'pointer' }}><Trash2 size={15} />{deleting === item.businessId ? 'Deleting...' : 'Delete'}</button></div>)}</div>}
        </div>
      </div>
    </div>, document.body
  ) : null;

  return <>{button}{modal}</>;
}
