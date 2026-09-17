import { useTranslation } from 'react-i18next';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/i18n/use-language';
import { SUPPORTED_LOCALES, isLocale, type SupportedLocale } from '@/i18n/types';
import { cn } from '@/lib/utils';

export interface LanguageSwitcherProps {
  value?: SupportedLocale;
  onChange?: (locale: SupportedLocale) => void;
  className?: string;
}

const LOCALE_LABEL_KEY: Record<SupportedLocale, string> = {
  en: 'common:language.english',
  id: 'common:language.indonesian',
};

export function LanguageSwitcher({ value, onChange, className }: LanguageSwitcherProps) {
  const { t } = useTranslation();
  const { locale, setLocale } = useLanguage();

  const current: SupportedLocale = value ?? locale;

  function handleChange(next: string) {
    if (!isLocale(next)) return;
    if (onChange) {
      onChange(next);
      return;
    }
    void setLocale(next);
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger
        size="sm"
        aria-label={t('common:language.switcherAria')}
        className={cn('w-[132px]', className)}
      >
        <SelectValue placeholder={t('common:language.label')} />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LOCALES.map((code) => (
          <SelectItem key={code} value={code}>
            {t(LOCALE_LABEL_KEY[code])}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
