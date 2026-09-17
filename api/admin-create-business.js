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

  let createdUserId = null;
  let createdBusinessId = null;

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
    const temporaryPassword = typeof body.temporaryPassword === 'string' ? body.temporaryPassword : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const city = typeof body.city === 'string' ? body.city.trim() : '';

    if (!businessName || !clientEmail || !temporaryPassword) {
      return json(res, 400, { error: 'Business name, client email and temporary password are required.' });
    }
    if (!/^\S+@\S+\.\S+$/.test(clientEmail)) {
      return json(res, 400, { error: 'Please enter a valid client email address.' });
    }
    if (temporaryPassword.length < 8) {
      return json(res, 400, { error: 'Temporary password must be at least 8 characters.' });
    }

    // Create a real password-auth user so the client can sign in immediately.
    // The password is sent only to Supabase Auth and is never stored in our tables or returned.
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: clientEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        name: clientName,
        role: 'business_owner'
      }
    });

    if (authError || !authData?.user?.id) {
      const message = authError?.message || 'The client account could not be created.';
      if (/already|exists|registered/i.test(message)) {
        return json(res, 409, { error: 'This email already has a Supabase account. Use that existing account or choose a different client email.' });
      }
      return json(res, 500, { error: message });
    }
    createdUserId = authData.user.id;

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

    if (businessError) throw new Error(`Could not create business: ${businessError.message}`);
    createdBusinessId = business.id;

    const { error: membershipError } = await supabase.from('business_admins').insert({
      user_id: createdUserId,
      business_id: createdBusinessId,
      role: 'owner'
    });

    if (membershipError) throw new Error(`Business was created but client access could not be assigned: ${membershipError.message}`);

    return json(res, 201, {
      message: 'Business created successfully. The client can now sign in with the provided email and temporary password.',
      business: { ...business, clientEmail, clientName }
    });
  } catch (error) {
    console.error('Create business error:', error);

    if (createdBusinessId) {
      await supabase.from('businesses').delete().eq('id', createdBusinessId);
    }
    if (createdUserId) {
      await supabase.auth.admin.deleteUser(createdUserId);
    }

    return json(res, 500, { error: error.message || 'Could not create the business and client account.' });
  }
}
