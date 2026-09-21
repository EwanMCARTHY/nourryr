import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_URL = 'https://fllsiukeseqwcuqsdylp.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsbHNpdWtlc2Vxd2N1cXNkeWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMTgyNzYsImV4cCI6MjEwNTU5NDI3Nn0.s1pnOelzk-S2ewcB4o4wrvh6E2Eg0hw8h7kBmxOt2is';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const url =
    localStorage.getItem('nourryr_supabase_url') ||
    import.meta.env.VITE_SUPABASE_URL ||
    DEFAULT_SUPABASE_URL;

  const key =
    localStorage.getItem('nourryr_supabase_anon_key') ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY;

  if (url && key) {
    try {
      supabaseInstance = createClient(url, key);
      return supabaseInstance;
    } catch (e) {
      console.error('Failed to init Supabase client', e);
    }
  }
  return null;
}

export function resetSupabaseClient(url: string, key: string) {
  if (url && key) {
    localStorage.setItem('nourryr_supabase_url', url);
    localStorage.setItem('nourryr_supabase_anon_key', key);
    supabaseInstance = createClient(url, key);
  } else {
    localStorage.removeItem('nourryr_supabase_url');
    localStorage.removeItem('nourryr_supabase_anon_key');
    // Fallback to default instance
    supabaseInstance = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);
  }
}
