import { config } from 'dotenv';

export class LocalEnvironment {
  static Load() {
    const loaded = config({ path: '.env.local', override: true });
    if (loaded.error) throw new Error('Crie .env.local a partir de .env.local.example.');
    const expected = {
      DB_HOST: '127.0.0.1', DB_PORT: '5433', DB_NAME: 'geomash_criteria_test',
      DB_USER: 'geomash_local', DB_SSL: 'false', DISABLE_SUPABASE: 'true',
    };
    for (const [key, value] of Object.entries(expected)) {
      if (loaded.parsed?.[key] !== value) throw new Error(`Modo local exige ${key}=${value}. Nenhuma conexão foi iniciada.`);
    }
    if (!loaded.parsed?.DB_PASSWORD || !loaded.parsed?.PORT) throw new Error('DB_PASSWORD e PORT são obrigatórios no perfil local.');
    process.env.ALLOW_REMOTE_DATABASE = 'false';
    console.log('Critérios: PostgreSQL LOCAL em 127.0.0.1:5433/geomash_criteria_test. Supabase bloqueado.');
  }
}
