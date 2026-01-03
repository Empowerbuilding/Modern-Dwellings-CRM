/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Allow booking widget script to be loaded from any domain
        source: '/booking-widget.js',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        // Allow booking pages to be embedded in iframes
        source: '/book/:path*',
        headers: [
          // Remove X-Frame-Options to allow embedding
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          // Content-Security-Policy frame-ancestors allows embedding from any origin
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self' *" },
        ],
      },
      {
        // CORS headers for public calendar APIs (for external integrations)
        source: '/api/calendar/:path(availability|available-dates|book)',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
      {
        // CORS headers for meeting type APIs (for external integrations)
        source: '/api/meeting-types/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
