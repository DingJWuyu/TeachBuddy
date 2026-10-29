import { markAccountDeleted, clearAccountDeviceData } from './platform/device/storage.js';
import { clearQuestionDeviceData } from './features/questions/uploadRecovery.js';
import { clearResourceDeviceData } from './features/resources/pendingRequests.js';
import { clearMathDeviceData } from './features/math/uploadDraft.js';
import { clearAgentDeviceData } from './features/agent/AgentProvider.jsx';
import { clearRecoveryDeviceData } from './platform/device/deviceRecovery.js';
import { clearClassroomDeviceData } from './features/classroom/api.js';
import { clearSampleWeekDeviceData } from './features/workbench/demo/seed.js';

export async function clearDeletedAccountDeviceData(account) {
  markAccountDeleted(account);
  await clearQuestionDeviceData(account);
  await clearResourceDeviceData(account);
  await clearMathDeviceData(account);
  await clearClassroomDeviceData(account);
  await clearSampleWeekDeviceData(account);
  clearAgentDeviceData(account);
  clearRecoveryDeviceData(account);
  clearAccountDeviceData(account);
}
