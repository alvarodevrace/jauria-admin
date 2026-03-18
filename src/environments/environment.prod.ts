export const environment = {
  production: true,
  supabaseUrl: 'https://bxatcmcommoqnxnyqchu.supabase.co',
  supabaseAnonKey: '', // Set via CI/CD secret: SUPABASE_ANON_KEY
  backendApiUrl: '', // Set via CI/CD secret or file replacement once backend domain is deployed
  externalOpsChecksEnabled: true,
  // GlitchTip DSN — actualizar cuando DNS glitchtip.alvarodevrace.tech esté configurado
  sentryEnabled: true,
  sentryDsn: 'https://8a43cf1897b44e1ba32121e2e3368cd5@glitchtip.alvarodevrace.tech/1',
};
