// netlify/functions/track.js
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    // ignore
  }

  const path =
    body.path ||
    event.headers['x-nf-request-path'] ||
    '/';

  const userAgent =
    body.userAgent ||
    event.headers['user-agent'] ||
    '';

  const anonId = body.anonId || null;

  // IP 해시는 옵션 (나중에 쓸 수도 있어서 그대로 둠)
  const ip =
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['x-forwarded-for'] ||
    event.headers['client-ip'] ||
    '';

  const ipHash = ip
    ? crypto.createHash('sha256').update(ip).digest('hex')
    : null;

  const { error } = await supabase
    .from('page_views')
    .insert([
      {
        path,
        user_agent: userAgent,
        ip_hash: ipHash,
        anon_id: anonId
      }
    ]);

  if (error) {
    console.error('Supabase insert error', error);
    return {
      statusCode: 500,
      body: 'Error'
    };
  }

  return {
    statusCode: 200,
    body: 'OK'
  };
};
