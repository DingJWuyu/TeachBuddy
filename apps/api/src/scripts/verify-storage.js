import { createApp } from '../app.js';

const { dataStore, env } = createApp();

console.log(`SQLite storage verified at ${env.sqlitePath}`);

dataStore.close();
