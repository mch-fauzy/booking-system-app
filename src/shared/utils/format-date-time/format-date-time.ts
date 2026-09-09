import { APP_LOCALE, APP_TIME_ZONE } from '@/shared/constants/app';

const formatter = new Intl.DateTimeFormat(APP_LOCALE, {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: APP_TIME_ZONE,
});

export function formatDateTime(iso: string): string {
  return formatter.format(new Date(iso));
}
