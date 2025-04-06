'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'

export default function Home() {
  const { data: session, status } = useSession()

  return (
    <main className="min-h-screen p-4 flex flex-col items-center space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Baby Monitor</h1>
        <p className="text-muted-foreground max-w-md">
          A simple and secure way to monitor your baby from another room or device.
        </p>
      </div>

      {status === 'loading' ? (
        <div>Loading...</div>
      ) : session ? (
        <>
          <div className="text-center">
            <p className="text-muted-foreground">Signed in as {session.user?.email}</p>
            <button
              onClick={() => signOut()}
              className="mt-2 text-primary hover:underline"
            >
              Sign out
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl">
            <Link
              href="/camera"
              className="p-6 bg-card border rounded-lg hover:border-primary transition-colors text-center"
            >
              <h2 className="text-xl font-semibold">Camera Mode</h2>
              <p className="mt-2 text-muted-foreground">
                Use this device as a camera to monitor your baby
              </p>
            </Link>

            <Link
              href="/monitor"
              className="p-6 bg-card border rounded-lg hover:border-primary transition-colors text-center"
            >
              <h2 className="text-xl font-semibold">Monitor Mode</h2>
              <p className="mt-2 text-muted-foreground">
                View the camera feed from another device
              </p>
            </Link>
          </div>
        </>
      ) : (
        <div className="space-y-4 text-center">
          <p className="text-muted-foreground">Please sign in to use the baby monitor</p>
          <div className="space-x-4">
            <Link
              href="/auth/signin"
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="px-6 py-3 border border-input rounded-lg hover:bg-accent transition-colors"
            >
              Sign Up
            </Link>
          </div>
        </div>
      )}
    </main>
  )
}
