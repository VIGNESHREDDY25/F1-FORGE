import app from './app';
import { config } from './config';
import { initStore, seedIfEmpty } from './db/store';
import { startScheduler } from './services/scheduler';

async function start() {
  await initStore();   // load snapshot (Postgres or file) BEFORE seeding/saving
  seedIfEmpty();
  startScheduler();

  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port} [${config.env}]`);
  });
}

start();
