import AuthForm from '@/components/AuthForm';
import { safeReturnPath } from '@/lib/auth';

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  return <AuthForm mode="register" next={safeReturnPath(params.next)} />;
}
