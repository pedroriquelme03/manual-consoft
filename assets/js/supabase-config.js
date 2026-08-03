// Configuração do Supabase — projeto "Manual CEC"
// Chave publishable (pública, segura para frontend). A escrita é protegida por RLS (apenas admin autenticado).
window.CEC_CONFIG = {
  SUPABASE_URL: 'https://yyirausqbojcehtajfvs.supabase.co',
  SUPABASE_KEY: 'sb_publishable_G8LvS3pAEUMBPHhWMu2vvw_2OO3uvqR',
  BUCKET: 'manual-images',
};

// Cliente Supabase compartilhado (supabase-js carregado via CDN antes deste script)
window.cecClient = window.supabase.createClient(
  window.CEC_CONFIG.SUPABASE_URL,
  window.CEC_CONFIG.SUPABASE_KEY
);
