import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'OKAZ - Comparez 5 sites en 30 secondes';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#F8FAFC',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle accent orb */}
        <div
          style={{
            position: 'absolute',
            top: '-200px',
            right: '-200px',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-200px',
            left: '-200px',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Logo */}
        <div
          style={{
            fontSize: 128,
            fontWeight: 700,
            color: '#0F172A',
            letterSpacing: '-3px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <span style={{ color: '#6366F1' }}>O</span>
          <span>KAZ</span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 44,
            fontWeight: 500,
            color: '#475569',
            marginTop: '12px',
            display: 'flex',
          }}
        >
          Comparez 5 sites en 30 secondes
        </div>

        {/* Sites */}
        <div
          style={{
            display: 'flex',
            gap: '32px',
            marginTop: '48px',
            fontSize: 28,
            fontWeight: 500,
          }}
        >
          <span style={{ color: '#F97316' }}>LeBonCoin</span>
          <span style={{ color: '#CBD5E1' }}>|</span>
          <span style={{ color: '#2DD4BF' }}>Vinted</span>
          <span style={{ color: '#CBD5E1' }}>|</span>
          <span style={{ color: '#3B82F6' }}>Back Market</span>
          <span style={{ color: '#CBD5E1' }}>|</span>
          <span style={{ color: '#DAA520' }}>Amazon</span>
          <span style={{ color: '#CBD5E1' }}>|</span>
          <span style={{ color: '#EF4444' }}>eBay</span>
        </div>

        {/* Badge IA */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: '40px',
            padding: '12px 32px',
            borderRadius: '999px',
            background: 'rgba(99,102,241,0.08)',
            border: '2px solid rgba(99,102,241,0.2)',
            fontSize: 24,
            fontWeight: 500,
            color: '#6366F1',
          }}
        >
          Analyse IA de chaque annonce
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: '28px',
            fontSize: 20,
            color: '#94A3B8',
            display: 'flex',
          }}
        >
          okaz-ia.fr
        </div>
      </div>
    ),
    { ...size }
  );
}
