import { LocalEnvironment } from './LocalEnvironment.mjs';
LocalEnvironment.Load();
await import('../src/server.ts');
