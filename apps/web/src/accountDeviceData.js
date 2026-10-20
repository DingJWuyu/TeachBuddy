import { markAccountDeleted, clearAccountDeviceData } from './platform/device/storage.js';
import { clearQuestionDeviceData } from './features/questions/uploadRecovery.js';
import { clearResourceDeviceData } from './features/resources/pendingRequests.js';
import { clearMathDeviceData } from './features/math/uploadDraft.js';
import { clearAgentDeviceData } from './features/agent/AgentProvider.jsx';
import { clearRecoveryDeviceData } from './features/reliability/deviceRecovery.js';
import { clearClassroomDeviceData } from './features/classroom/api.js';

export async function clearDeletedAccountDeviceData(account) {
  markAccountDeleted(account);
  await clearQuestionDeviceData(account);
  await clearResourceDeviceData(account);
  await clearMathDeviceData(account);
  await clearClassroomDeviceData(account);
  clearAgentDeviceData(account);
  clearRecoveryDeviceData(account);
  clearAccountDeviceData(account);
}
