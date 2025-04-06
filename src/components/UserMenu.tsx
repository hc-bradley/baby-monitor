'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function UserMenu() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session) {
    return (
      <div className="flex items-center space-x-4">
        <Link
          href="/auth/signin"
          className="text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          Sign in
        </Link>
        <Link
          href="/auth/signup"
          className="text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          Sign up
        </Link>
      </div>
    );
  }

  const username = session.user?.username || 'User';

  return (
    <div className="flex items-center space-x-4">
      <span className="text-sm text-gray-700">
        Signed in as {username}
      </span>
      <button
        onClick={() => signOut()}
        className="text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        Sign out
      </button>
    </div>
  );
}