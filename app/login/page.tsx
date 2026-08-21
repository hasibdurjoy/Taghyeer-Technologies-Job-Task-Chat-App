import type { Metadata } from 'next';

import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Sign in — Parley',
  description: 'Sign in with your phone number and name to start messaging on Parley.',
};

export default function LoginPage() {
  return <LoginForm />;
}
