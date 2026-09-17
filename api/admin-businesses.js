import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
});

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function requireSuperAdmin(req) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) throw Object.assign(new Error('Authentication is required.'), { status: 401 });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error('Your session is invalid or expired.'), { status: 401 });
  const { data: admin, error: adminError } = await supabase.from('platform_super_admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
  if (adminError) throw Object.assign(new Error('Could not verify platform administrator access.'), { status: 500 });
  if (!admin) throw Object.assign(new Error('Only the platform super admin can manage businesses.'), { status: 403 });
  return data.user;
}

async function removeKnowledgeFiles(businessId) {
  const bucket = supabase.storage.from('business-knowledge');
  const { data: files } = await bucket.list(businessId, { limit: 1000, offset: 0 });
  if (files?.length) await bucket.remove(files.map(file => `${businessId}/${file.name}`));
}

export default async function handler(req, res) {
  try {
    const adminUser = await requireSuperAdmin(req);

    if (req.method === 'GET') {
      const { data: businesses, error } = await supabase.from('businesses').select('id,name,email,created_at').order('created_at', { ascending: false });
      if (error) throw Object.assign(new Error(error.message), { status: 500 });

      const rows = [];
      for (const business of businesses || []) {
        const { data: owners, error: ownerError } = await supabase.from('business_admins').select('user_id,role').eq('business_id', business.id).eq('role', 'owner');
        if (ownerError) throw Object.assign(new Error(ownerError.message), { status: 500 });
        for (const owner of owners || []) {
          const { data: userData } = await supabase.auth.admin.getUserById(owner.user_id);
          rows.push({
            businessId: business.id,
            businessName: business.name,
            businessEmail: business.email || userData.user?.email || '',
            ownerName: userData.user?.user_metadata?.name || userData.user?.user_metadata?.full_name || '',
            ownerEmail: userData.user?.email || business.email || '',
            createdAt: business.created_at,
            isCurrentAdminBusiness: business.id === adminUser.user_metadata?.business_id
          });
        }
      }
      return json(res, 200, { businesses: rows });
    }

    if (req.method === 'DELETE') {
      const businessId = typeof req.query?.businessId === 'string' ? req.query.businessId : '';
      if (!businessId) return json(res, 400, { error: 'Business ID is required.' });
      if (businessId === '871037de-f95f-468f-8089-ddc30e8b9170') return json(res, 409, { error: 'The original test business cannot be deleted from this control.' });

      const { data: memberships, error: membershipError } = await supabase.from('business_admins').select('user_id').eq('business_id', businessId);
      if (membershipError) throw Object.assign(new Error(membershipError.message), { status: 500 });
      await removeKnowledgeFiles(businessId);
      const { error: deleteError } = await supabase.from('businesses').delete().eq('id', businessId);
      if (deleteError) throw Object.assign(new Error(deleteError.message), { status: 500 });
      for (const membership of memberships || []) {
        if (membership.user_id !== adminUser.id) await supabase.auth.admin.deleteUser(membership.user_id);
      }
      return json(res, 200, { message: 'Business and client access deleted successfully.' });
    }

    return json(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    console.error('Admin businesses error:', error);
    return json(res, error.status || 500, { error: error.message || 'Could not manage businesses.' });
  }
}
