export type AppNotification = {
  id: number;
  title: string;
  message: string;
  href: string;
  is_read: boolean;
  created_at: string;
};

export function notificationHref(value: string) {
  if (value === '/lend') return '/lend/requests';
  return value === '/transactions' || value === '/lend/requests' || /^\/chat\/\d+$/.test(value) ? value : '/notifications';
}
