'use client'

import { Suspense } from 'react'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function ErrorContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const error = searchParams?.get('error') ?? 'Unknown error'

  useEffect(() => {
    // Redirect to sign in after 5 seconds
    const timer = setTimeout(() => {
      router.push('/auth/signin')
    }, 5000)

    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Authentication Error
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {error === 'Configuration'
              ? 'There is a problem with the server configuration. Please try again later.'
              : 'An error occurred during authentication. Please try again.'}
          </p>
        </div>
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            You will be redirected to the sign in page in 5 seconds...
          </p>
          <button
            onClick={() => router.push('/auth/signin')}
            className="mt-4 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Return to Sign In
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AuthError() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Loading...
            </h2>
          </div>
        </div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  )
}