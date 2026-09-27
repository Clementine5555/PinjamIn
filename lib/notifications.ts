export type AppNotification = {
  id: number;
  title: string;
  message: string;
  href: string;
  is_read: boolean;
  created_at: string;
};

export function notificationHref(value: string) {
  return value === '/transactions' ? value : '/notifications';
}
