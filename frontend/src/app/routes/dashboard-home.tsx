import { useTranslation } from 'react-i18next';

export function DashboardHomePage() {
  const { t } = useTranslation('dashboard');
  return (
    <div className="flex flex-1 flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed">
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      </div>
    </div>
  );
}
