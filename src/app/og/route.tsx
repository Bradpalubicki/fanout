import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '1200px',
          height: '630px',
          background: '#000',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '24px',
          padding: '80px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              background: '#fff',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path
                d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
                fill="#000"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span
            style={{
              fontSize: '56px',
              fontWeight: '900',
              color: '#fff',
              letterSpacing: '-2px',
            }}
          >
            Fanout
          </span>
        </div>
        <p
          style={{
            fontSize: '28px',
            color: '#999',
            textAlign: 'center',
            maxWidth: '800px',
            lineHeight: '1.4',
            margin: '0',
          }}
        >
          Social Media API — Post to 9 platforms with one API call
        </p>
        <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
          {['Twitter', 'LinkedIn', 'Instagram', 'TikTok', 'YouTube', 'Reddit'].map((p) => (
            <div
              key={p}
              style={{
                background: '#111',
                border: '1px solid #333',
                borderRadius: '8px',
                padding: '8px 16px',
                color: '#888',
                fontSize: '14px',
              }}
            >
              {p}
            </div>
          ))}
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            right: '80px',
            fontSize: '18px',
            color: '#555',
          }}
        >
          fanout.digital
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
