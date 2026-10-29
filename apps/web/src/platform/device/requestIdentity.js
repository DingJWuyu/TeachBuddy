// Physical names are permanent compatibility identities, independent of the
// product module catalog. Only this device implementation interprets them.
export const requestIdentities = {
  resources: { database: 'teachbuddy-resources-pending', storeName: 'requests', name: 'pending:resources' },
  math: { database: 'teachbuddy.math.uploads', storeName: 'pending', name: 'pending:math-upload' },
  questions: { database: 'teachbuddy.questions.uploads', storeName: 'pending', name: 'pending:questions-upload' },
  classroom: { database: 'teachbuddy-classroom-pending', storeName: 'requests', name: 'pending:classroom-upload' },
  sampleWeek: { database: 'teachbuddy-sample-week', storeName: 'requests', name: 'pending:sample-week:', slots: true },
};

export function requestIdentity(identity) {
  const binding = requestIdentities[identity];
  if (!binding) throw new Error('Unknown device request identity');
  return binding;
}

export function openRequestDatabase({ database, storeName }) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
