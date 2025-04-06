import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 space-y-8">
      <h1 className="text-4xl font-bold text-center">Baby Monitor</h1>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/camera"
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-center"
        >
          Camera Mode
        </Link>
        <Link
          href="/monitor"
          className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 transition-opacity text-center"
        >
          Monitor Mode
        </Link>
      </div>
      <p className="text-muted-foreground text-center max-w-md">
        Choose Camera Mode on the device you want to use as the baby monitor camera,
        and Monitor Mode on the device where you want to watch the video feed.
      </p>
    </main>
  )
}
