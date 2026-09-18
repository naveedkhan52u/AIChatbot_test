import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUSINESS_SLUG = process.env.BUSINESS_SLUG || 'aichatbot-test-business';

function json(res, status, body) { res.status(status).setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); }
function clean(value, max=500) { return String(value || '').replace(/\u0000/g, '').trim().slice(0, max); }

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return json(res, 500, { error: 'Server configuration is incomplete.' });
  try {
    const { name, email, subject, businessId, businessSlug } = req.body || {};
    const customerName = clean(name, 120);
    const customerEmail = clean(email, 254).toLowerCase();
    const customerSubject = clean(subject, 200);
    if (!customerName || !customerEmail || !customerSubject) return json(res, 400, { error: 'Name, email, and subject are required.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) return json(res, 400, { error: 'Please enter a valid email address.' });

    let query = supabase.from('businesses').select('id').eq('status','active');
    if (typeof businessId === 'string' && businessId.trim()) query = query.eq('id', businessId.trim());
    else query = query.eq('slug', typeof businessSlug === 'string' && businessSlug.trim() ? businessSlug.trim() : BUSINESS_SLUG);
    const { data: business, error: businessError } = await query.single();
    if (businessError || !business) return json(res, 404, { error: 'Business is not available.' });

    const { error } = await supabase.from('leads').insert({ business_id: business.id, name: customerName, email: customerEmail, subject: customerSubject, source: 'chatbot', status: 'new' });
    if (error) { console.error('Lead insert error:', error); return json(res, 500, { error: 'Could not send your contact request.' }); }
    return json(res, 200, { success: true });
  } catch (error) { console.error('Contact lead API error:', error); return json(res, 500, { error: 'Could not send your contact request.' }); }
}
