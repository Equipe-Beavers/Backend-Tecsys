import { config } from 'dotenv';

const loaded = config({ path: '.env', override: true });
if (loaded.error) throw new Error('Configuração .env não encontrada.');

const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
const databaseHost = loaded.parsed?.DB_HOST ?? 'localhost';
if (!localHosts.has(databaseHost)) {
  throw new Error('Modo loopback exige um banco PostgreSQL no próprio computador.');
}

for (const key of ['DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
  if (!loaded.parsed?.[key]) throw new Error(`${key} deve estar definida no .env.`);
}

process.env.ALLOW_REMOTE_DATABASE = 'false';
process.env.DISABLE_SUPABASE = 'true';
process.env.API_HOST = '127.0.0.1';
process.env.PORT = '3000';
console.log(`API local conectando ao PostgreSQL em ${databaseHost}; acesso remoto bloqueado.`);

await import('../src/server.ts');