import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Hard-block legacy PWA endpoints so browsers stop requesting them.
export function proxy(req: NextRequest) {
  // 410 Gone with no-store to discourage retries/caching
  return new NextResponse('PWA disabled', {
    status: 410,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}

// Limit proxy only to these routes
export const config = {
  matcher: [
    '/manifest.json',
    '/sw.js',
    '/service-worker.js',
    '/workbox-:path*',
  ],
}
