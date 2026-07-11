import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Yeni Supabase projesinin bilgileri .env dosyasından gelir (bkz. .env.example
// ve docs/supabase-kurulum.md). Env tanımsızsa uygulama çökmesin diye geçersiz
// ama biçimi doğru bir placeholder kullanılır; istekler sessizce başarısız olur
// (kod her yerde local-first çalıştığı için uygulama offline gibi davranır).
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://yapilandirilmadi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_yapilandirilmadi';

export const isSupabaseConfigured =
  Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);


function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: {
    fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
  },
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
