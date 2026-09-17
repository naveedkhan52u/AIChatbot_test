import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Building2, Trash2, X, RefreshCw, ShieldCheck, KeyRound } from 'lucide-react';
import { getSupabase } from './lib/supabase';
import './superadmin.css';

const SUPER_ADMIN_USER_ID = '49149fcb-fbd5-4079-befd-3af7fd8e1725';

export default function SuperAdminBusinesses() {
  const [session, setSession] = useState(null);
  const [buttonHost, setButtonHost] = useState(null);
  const [open, setOpen] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [createNotice, setCreateNotice] = useState('');
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  const isSuperAdmin = session?.user?.id === SUPER_ADMIN_USER_ID;

  useEffect(() => {
    if (!isSuperAdmin) return undefined;
    const nav = document.querySelector('.sidebar nav');
    if (!nav) return undefined;
    const host = document.createElement('div');
    nav.appendChild(host);
    setButtonHost(host);
    return () => host.remove();
  }, [isSuperAdmin]);

  // The main dashboard already contains the Create Business form. This enhancer
  // adds the password field and securely submits that form to the new password-auth API.
  useEffect(() => {
    if (!isSuperAdmin) return undefined;

    let cleanup = () => {};
    let observer;

    const enhance = () => {
      const form = document.querySelector('.super-admin-page .super-admin-card form');
      if (!form || form.dataset.passwordEnhanced === 'true') return;

      const inputs = form.querySelectorAll('input');
      if (inputs.length < 3) return;
      const emailInput = inputs[2];
      const emailLabel = emailInput.closest('label');
      if (!emailLabel) return;

      const passwordLabel = document.createElement('label');
      passwordLabel.innerHTML = '<span>Temporary password *</span>';
      const passwordInput = document.createElement('input');
      passwordInput.type = 'password';
      passwordInput.autocomplete = 'new-password';
      passwordInput.minLength = 8;
      passwordInput.required = true;
      passwordInput.placeholder = 'At least 8 characters';
      passwordInput.className = emailInput.className;
      passwordLabel.appendChild(passwordInput);
      emailLabel.insertAdjacentElement('afterend', passwordLabel);

      const heading = document.querySelector('.super-admin-card .section-heading h2');
      if (heading) heading.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px"><span>🛡</span> Create Business + Client Login</span>';
      const description = document.querySelector('.super-admin-card .section-heading .muted');
      if (description) description.textContent = 'Create the business and a password-based client account. The client can sign in immediately.';
      const submitButton = form.querySelector('button[type="submit"]');
      if (submitButton) submitButton.textContent = 'Create Business + Client Login';

      const help = document.createElement('div');
      help.style.cssText = 'grid-column:1/-1;font-size:12px;color:#68758b;margin-top:-4px;';
      help.textContent = 'The temporary password is used only by Supabase Auth. It is never stored in your business database or returned by the API.';
      passwordLabel.insertAdjacentElement('afterend', help);

      const submitHandler = async (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        setCreateError('');
        setCreateNotice('');

        const currentInputs = form.querySelectorAll('input');
        const businessName = currentInputs[0]?.value.trim() || '';
        const clientName = currentInputs[1]?.value.trim() || '';
        const clientEmail = currentInputs[2]?.value.trim() || '';
        const phone = currentInputs[3]?.value.trim() || '';
        const city = currentInputs[4]?.value.trim() || '';
        const descriptionValue = form.querySelector('textarea')?.value.trim() || '';
        const temporaryPassword = passwordInput.value;

        if (!businessName || !clientEmail || !temporaryPassword) {
          setCreateError('Business name, client email and temporary password are required.');
          return;
        }
        if (temporaryPassword.length < 8) {
          setCreateError('Temporary password must be at least 8 characters.');
          return;
        }

        const { data: sessionData } = await getSupabase().auth.getSession();
        const token = sessionData.session?.access_token || session?.access_token;
        const button = form.querySelector('button[type="submit"]');
        if (button) { button.disabled = true; button.textContent = 'Creating account...'; }

        try {
          const response = await fetch('/api/admin-create-business', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ businessName, clientName, clientEmail, temporaryPassword, phone, city, description: descriptionValue })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Could not create business.');

          form.reset();
          setCreateNotice(`✓ ${data.business.name} created. ${data.business.clientEmail} can now sign in using the temporary password you set.`);
          setTimeout(() => {
            const overviewButton = Array.from(document.querySelectorAll('.sidebar nav button')).find(btn => btn.textContent.trim() === 'Overview');
            overviewButton?.click();
          }, 900);
        } catch (err) {
          setCreateError(err.message || 'Could not create business.');
        } finally {
          if (button) { button.disabled = false; button.textContent = 'Create Business + Client Login'; }
        }
      };

      form.addEventListener('submit', submitHandler, true);
      form.dataset.passwordEnhanced = 'true';

      const observerLocal = new MutationObserver(() => {
        if (!document.body.contains(form)) cleanup();
      });
      observerLocal.observe(document.body, { childList: true, subtree: true });

      cleanup = () => {
        form.removeEventListener('submit', submitHandler, true);
        observerLocal.disconnect();
        delete form.dataset.passwordEnhanced;
      };
    };

    enhance();
    observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer?.disconnect(); cleanup(); };
  }, [isSuperAdmin, session]);

  // Display notices from the password-based creation flow inside the existing page.
  useEffect(() => {
    if (!isSuperAdmin) return undefined;
    const host = document.querySelector('.super-admin-page .super-admin-card');
    if (!host) return undefined;
    const existing = host.querySelector('[data-super-create-notice]');
    if (existing) existing.remove();
    if (!createNotice && !createError) return undefined;
    const box = document.createElement('div');
    box.dataset.superCreateNotice = 'true';
    box.className = createError ? 'error-box' : 'save-note';
    box.style.marginBottom = '14px';
    box.textContent = createError || createNotice;
    const form = host.querySelector('form');
    host.insertBefore(box, form || null);
    return () => box.remove();
  }, [createNotice, createError, isSuperAdmin]);

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

  if (!buttonHost || !isSuperAdmin) return null;

  const button = createPortal(
    <button type="button" onClick={openBusinesses} className="super-admin-nav-button"><Building2 size={17} /> Businesses</button>,
    buttonHost
  );

  const modal = open ? createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(15,23,42,.48)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div style={{ width: 'min(980px, 100%)', maxHeight: '88vh', overflow: 'auto', background: '#fff', borderRadius: 18, boxShadow: '0 30px 90px rgba(0,0,0,.25)' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 15, padding: '18px 22px', background: '#fff', borderBottom: '1px solid #e8ecf2' }}>
          <div><div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#172033' }}><ShieldCheck size={19} /> Created Businesses</div><div style={{ color: '#7a8698', fontSize: 12, marginTop: 4 }}>Business owners created through your Super Admin dashboard.</div></div>
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
