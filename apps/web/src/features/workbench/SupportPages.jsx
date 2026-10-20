import { useTranslation } from 'react-i18next';
import { Icon } from '../../components/icons.jsx';
import { HelpCenter } from './help/HelpCenter.jsx';
import './support-shell.css';

export function SupportHelp() { return <HelpCenter />; }

export function SupportReleases() {
  const { t } = useTranslation('workbench');
  return <div className="support-releases-placeholder" data-region="releases" role="img" aria-label={t('更新日志')}><Icon name="newspaper" size={44} strokeWidth={1.4} /></div>;
}
