import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function resolveEnv(...names: Array<string | undefined>) {
  const envSources: Array<Record<string, any>> = [];

  if (typeof import.meta !== 'undefined' && typeof (import.meta as any).env === 'object') {
    envSources.push((import.meta as any).env);
  }

  if (typeof globalThis !== 'undefined') {
    const globalEnv = (globalThis as any).process?.env;
    if (globalEnv && typeof globalEnv === 'object') {
      envSources.push(globalEnv);
    }

    const injectedEnv = (globalThis as any).__ENV;
    if (injectedEnv && typeof injectedEnv === 'object') {
      envSources.push(injectedEnv);
    }
  }

  for (const env of envSources) {
    for (const n of names) {
      if (!n) continue;
      const v = env[n];
      if (typeof v === 'string' && v.length > 0) return v;
    }
  }

  return undefined;
}

export function hasSupabaseConfig(): boolean {
  const url = resolveEnv(
    'NEXT_PUBLIC_SUPABASE_URL',
    'VITE_SUPABASE_URL',
    'SUPABASE_URL'
  );
  const key = resolveEnv(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_ANON_KEY',
    'SUPABASE_ANON_KEY',
    'SUPABASE_PUBLISHABLE_KEY'
  );
  return Boolean(url && key);
}

export function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = resolveEnv(
    'NEXT_PUBLIC_SUPABASE_URL',
    'VITE_SUPABASE_URL',
    'SUPABASE_URL'
  );
  const supabaseKey = resolveEnv(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_ANON_KEY',
    'SUPABASE_ANON_KEY',
    'SUPABASE_PUBLISHABLE_KEY'
  );

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase variables missing', {
      supabaseUrl: Boolean(supabaseUrl),
      supabaseKey: Boolean(supabaseKey),
    });
    throw new Error('Missing Supabase environment variables');
  }

  console.log('Supabase env loaded', {
    supabaseUrl,
    hasSupabaseKey: Boolean(supabaseKey),
  });

  return createClient(supabaseUrl, supabaseKey);
}
