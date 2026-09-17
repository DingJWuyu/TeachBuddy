import { createApp } from '../app.js';

const { dataStore, env } = createApp();

const snapshot = dataStore.snapshot();
const summary = Object.fromEntries(
  Object.entries(snapshot).map(([key, items]) => [key, items.length])
);

console.log(`SQLite storage verified at ${env.sqlitePath}`);
console.log(JSON.stringify(summary, null, 2));

dataStore.close();
