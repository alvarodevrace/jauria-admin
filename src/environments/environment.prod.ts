export const environment = {
  production: true,
  supabaseUrl: 'https://bxatcmcommoqnxnyqchu.supabase.co',
  supabaseAnonKey: '', // Set via CI/CD secret: SUPABASE_ANON_KEY
  n8nApiUrl: 'https://n8n.alvarodevrace.tech/api/v1',
  n8nApiKey: '', // Set via CI/CD secret: N8N_API_KEY
  coolifyUrl: 'https://coolify.alvarodevrace.tech/api/v1',
  coolifyToken: '', // Set via CI/CD secret: COOLIFY_TOKEN
  evolutionApiUrl: 'https://evolution.alvarodevrace.tech',
  evolutionApiKey: '', // Set via CI/CD secret: EVOLUTION_API_KEY
  // GlitchTip DSN — actualizar cuando DNS glitchtip.alvarodevrace.tech esté configurado
  sentryEnabled: true,
  sentryDsn: 'https://8a43cf1897b44e1ba32121e2e3368cd5@glitchtip.alvarodevrace.tech/1',
};
