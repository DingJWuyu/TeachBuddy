import { useTranslation } from 'react-i18next';
import { useAgent } from './AgentProvider.jsx';

export function ReferenceAction({ route, onAdded }) {
  const { t } = useTranslation('agent');
  const agent = useAgent();
  if (route.name !== 'question' || !/^[a-f0-9-]{36}$/i.test(route.id)) return null;
  return <button className="wb-button" title={t("引用已保存版本；未保存的编辑请先保存")} onClick={() => {
    void agent.addReference('question', route.id);
    onAdded();
  }}>{t("加入对话")}</button>;
}
