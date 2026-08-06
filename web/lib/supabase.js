import { createClient } from '@supabase/supabase-js';

// Server-only: reads the service_role key from the server environment.
// Never import this file from a Client Component -- the key must not
// reach the browser bundle. leo.* has RLS enabled with no policies, so
// only service_role (which bypasses RLS) can read anything here.
export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configuradas nas variáveis de ambiente do projeto Vercel.'
    );
  }

  return createClient(url, key, { db: { schema: 'leo' } });
}
