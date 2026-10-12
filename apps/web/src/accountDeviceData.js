import { markAccountDeleted, clearAccountDeviceData } from './features/workbench/storage.js';
import { clearQuestionDeviceData } from './features/questions/uploadRecovery.js';
import { clearResourceDeviceData } from './features/resources/client.js';
import { clearMathDeviceData } from './features/math/uploadDraft.js';
import { clearAgentDeviceData } from './features/agent/AgentProvider.jsx';
import { clearRecoveryDeviceData } from './features/reliability/deviceRecovery.js';

export async function clearDeletedAccountDeviceData(account) {
  markAccountDeleted(account);
  await clearQuestionDeviceData(account);
  await clearResourceDeviceData(account);
  await clearMathDeviceData(account);
  clearAgentDeviceData(account);
  clearRecoveryDeviceData(account);
  clearAccountDeviceData(account);
}
