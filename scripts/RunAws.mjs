import { config } from 'dotenv';

// Explicit remote mode. Never invoked by local development or local tests.
const loaded = config({ path: '.env', override: true });
if (loaded.error) throw new Error('Configuração AWS .env não encontrada.');
for (const key of ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
  if (!loaded.parsed?.[key]) throw new Error(`${key} deve estar definida no .env AWS.`);
}
process.env.ALLOW_REMOTE_DATABASE = 'true';
console.log('Modo AWS explícito: usando a conexão PostgreSQL do .env.');
await import('../src/server.ts');
