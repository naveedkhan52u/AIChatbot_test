import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(res, status, body) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(res, 500, { error: 'Server configuration is incomplete.' });
  }

  try {
    const businessId = typeof req.query?.businessId === 'string' ? req.query.businessId.trim() : '';
    const businessSlug = typeof req.query?.businessSlug === 'string' ? req.query.businessSlug.trim() : '';

    let businessQuery = supabase
      .from('businesses')
      .select('id')
      .eq('status', 'active');

    if (businessId) {
      businessQuery = businessQuery.eq('id', businessId);
    } else if (businessSlug) {
      businessQuery = businessQuery.eq('slug', businessSlug);
    } else {
      return json(res, 400, { error: 'Business ID or slug is required.' });
    }

    const { data: business, error: businessError } = await businessQuery.single();

    if (businessError || !business) {
      return json(res, 404, { error: 'Business not found.' });
    }

    const { data: faqs, error: faqError } = await supabase
      .from('faqs')
      .select('question,created_at')
      .eq('business_id', business.id)
      .eq('status', 'active')
      .not('question', 'is', null)
      .order('created_at', { ascending: false })
      .limit(3);

    if (faqError) {
      console.error('Suggestions FAQ error:', faqError);
      return json(res, 500, { error: 'Could not load FAQ suggestions.' });
    }

    const suggestions = (faqs || [])
      .map(faq => String(faq.question || '').trim())
      .filter(Boolean)
      .filter((question, index, list) => list.indexOf(question) === index)
      .slice(0, 3);

    return json(res, 200, { suggestions });
  } catch (error) {
    console.error('Suggestions API error:', error);
    return json(res, 500, { error: 'Could not load suggestions.' });
  }
}
