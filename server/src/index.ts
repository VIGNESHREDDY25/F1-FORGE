import app from './app';
import { config } from './config';
import { loadStore, seedIfEmpty } from './db/store';
import { startScheduler } from './services/scheduler';

function start() {
  loadStore();
  seedIfEmpty();
  startScheduler();

  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port} [${config.env}]`);
  });
}

start();
