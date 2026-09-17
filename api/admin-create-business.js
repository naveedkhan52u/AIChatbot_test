import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
});

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || `business-${crypto.randomUUID().slice(0, 8)}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(res, 500, { error: 'Server configuration is incomplete.' });
  }

  try {
    const authorization = req.headers.authorization || '';
    const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!accessToken) return json(res, 401, { error: 'Authentication is required.' });

    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userData.user) return json(res, 401, { error: 'Your session is invalid or expired.' });

    const { data: superAdmin, error: adminError } = await supabase
      .from('platform_super_admins')
      .select('user_id')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (adminError) return json(res, 500, { error: 'Could not verify platform administrator access.' });
    if (!superAdmin) return json(res, 403, { error: 'Only the platform super admin can create businesses.' });

    const body = req.body || {};
    const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : '';
    const clientName = typeof body.clientName === 'string' ? body.clientName.trim() : '';
    const clientEmail = typeof body.clientEmail === 'string' ? body.clientEmail.trim().toLowerCase() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const city = typeof body.city === 'string' ? body.city.trim() : '';

    if (!businessName || !clientEmail) return json(res, 400, { error: 'Business name and client email are required.' });
    if (!/^\S+@\S+\.\S+$/.test(clientEmail)) return json(res, 400, { error: 'Please enter a valid client email address.' });

    const baseSlug = slugify(businessName);
    const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`;

    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .insert({
        name: businessName,
        slug,
        description,
        phone,
        email: clientEmail,
        city,
        status: 'active'
      })
      .select('id,name,slug')
      .single();
    if (businessError) return json(res, 500, { error: `Could not create business: ${businessError.message}` });

    const redirectTo = `${req.headers.origin || process.env.SITE_URL || 'https://ai-chatbot-test-kappa.vercel.app'}/admin`;
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(clientEmail, {
      data: { name: clientName, business_id: business.id, business_name: business.name },
      redirectTo
    });

    if (inviteError || !inviteData?.user?.id) {
      await supabase.from('businesses').delete().eq('id', business.id);
      const message = inviteError?.message || 'The invitation could not be created.';
      if (/already|exists|registered/i.test(message)) {
        return json(res, 409, { error: 'This email already has a Supabase account. Use a new client email for an invitation.' });
      }
      return json(res, 500, { error: message });
    }

    const { error: membershipError } = await supabase.from('business_admins').insert({
      user_id: inviteData.user.id,
      business_id: business.id,
      role: 'owner'
    });

    if (membershipError) {
      await supabase.auth.admin.deleteUser(inviteData.user.id);
      await supabase.from('businesses').delete().eq('id', business.id);
      return json(res, 500, { error: `Business was created but client access could not be assigned: ${membershipError.message}` });
    }

    return json(res, 201, {
      message: 'Business created and client invitation sent successfully.',
      business: { ...business, clientEmail, clientName }
    });
  } catch (error) {
    console.error('Create business error:', error);
    return json(res, 500, { error: 'Could not create the business and client invitation.' });
  }
}
