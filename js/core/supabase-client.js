/**
 * =====================================================
 * BRDOLWIN — Cliente Supabase
 * =====================================================
 * Inicializa a conexão com o Supabase.
 */

(function () {
  'use strict';

  // Configurações do Supabase
  const SUPABASE_URL = 'https://rkyqvekcziihssnfmjkd.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_hQXixhnotTTWQS0ZZWrGNg_KusPLYhS';

  // Inicializa o client globalmente
  if (typeof supabase !== 'undefined') {
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('[BRDOLWIN] 🚀 Supabase Client Inicializado');
  } else {
    console.error('[BRDOLWIN] Supabase library not loaded!');
  }
})();
