import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

function asUuid(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text) ? text : null;
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: 'Supabase service role nao configurado' }, { status: 500 });
    }

    const payload = await req.json().catch(() => ({}));
    const accountToken = asUuid(payload.accountToken);
    if (!accountToken) {
      return jsonResponse({ error: 'token invalido' }, { status: 400 });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: account, error: accountError } = await admin
      .from('client_portal_accounts')
      .select('id')
      .eq('portal_token', accountToken)
      .eq('is_active', true)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) return jsonResponse({ error: 'acesso invalido' }, { status: 403 });

    const { data: rows, error: invoicesError } = await admin
      .from('client_portal_invoices')
      .select('id, competence_month, storage_bucket, storage_path, file_name, mime_type, created_at')
      .eq('account_id', account.id)
      .order('competence_month', { ascending: false })
      .order('created_at', { ascending: false });
    if (invoicesError) throw invoicesError;

    const invoices = await Promise.all((rows || []).map(async (row) => {
      let signedUrl: string | undefined;
      if (row.storage_bucket && row.storage_path) {
        const { data } = await admin.storage
          .from(row.storage_bucket)
          .createSignedUrl(row.storage_path, 60 * 60);
        signedUrl = data?.signedUrl;
      }
      return {
        id: row.id,
        competence_month: row.competence_month,
        file_name: row.file_name,
        mime_type: row.mime_type,
        created_at: row.created_at,
        signed_url: signedUrl,
      };
    }));

    return jsonResponse({ invoices });
  } catch (err) {
    console.error('[client-portal-invoices] erro:', err);
    return jsonResponse({ error: String(err) }, { status: 500 });
  }
});
