import React, { useEffect, useState } from 'react';
import { Building2, Trash2, X, RefreshCw } from 'lucide-react';
import { getSupabase } from './lib/supabase';

const SUPER_ADMIN_EMAIL = 'naveedkhanu52@gmail.com';

export default function SuperAdminPanel() {
  const [session, setSession] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadBusinesses() {
    setLoading(true); setError('');
    try {
      const { data } = await getSupabase().auth.getSession();
      const token = data.session?.access_token;
      const response = await fetch('/api/admin-businesses', { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load businesses.');
      setBusinesses(result.businesses || []);
    } catch (err) { setError(err.message || 'Could not load businesses.'); }
    finally { setLoading(false); }
  }

  async function removeBusiness(item) {
    if (!window.confirm(`Delete ${item.businessName} and ${item.ownerEmail}'s access? This permanently deletes this business and its data.`)) return;
    setDeleting(item.businessId); setError('');
    try {
      const { data } = await getSupabase().auth.getSession();
      const response = await fetch(`/api/admin-businesses?businessId=${encodeURIComponent(item.businessId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${data.session?.access_token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not delete business.');
      setBusinesses(current => current.filter(b => b.businessId !== item.businessId));
    } catch (err) { setError(err.message || 'Could not delete business.'); }
    finally { setDeleting(null); }
  }

  if (session?.user?.email?.toLowerCase() !== SUPER_ADMIN_EMAIL) return null;

  return <>
    <button type="button" className="super-admin-businesses-button" onClick={() => { setOpen(true); loadBusinesses(); }}>
      <Building2 size={17} /> Businesses
    </button>
    {open && <div className="super-admin-overlay">
      <section className="super-admin-modal">
        <header className="super-admin-modal-header">
          <div><h2>Created Businesses</h2><p>Manage businesses created from the Super Admin dashboard.</p></div>
          <div className="super-admin-modal-actions"><button onClick={loadBusinesses} disabled={loading} title="Refresh"><RefreshCw size={16} /></button><button onClick={() => setOpen(false)} title="Close"><X size={18} /></button></div>
        </header>
        <div className="super-admin-business-list">
          {error && <div className="error-box">{error}</div>}
          {loading ? <div className="loading-card">Loading businesses...</div> : businesses.length === 0 ? <div className="empty-card">No created businesses found.</div> : businesses.map(item => <div className="super-admin-business-row" key={item.businessId}>
            <div><span>Owner Name</span><strong>{item.ownerName || 'Not provided'}</strong></div>
            <div><span>Business Name</span><strong>{item.businessName}</strong></div>
            <div><span>Owner Email</span><strong>{item.ownerEmail}</strong></div>
            <button className="super-admin-delete" disabled={deleting === item.businessId} onClick={() => removeBusiness(item)}><Trash2 size={15} /> {deleting === item.businessId ? 'Deleting...' : 'Delete'}</button>
          </div>)}
        </div>
      </section>
    </div>}
  </>;
}
