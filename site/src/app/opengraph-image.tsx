import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'OKAZ - La bonne affaire en 8 secondes';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
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
        {/* Gradient accent orb */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            right: '-100px',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-150px',
            left: '-100px',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Logo */}
        <div
          style={{
            fontSize: 96,
            fontWeight: 700,
            color: '#FFFFFF',
            letterSpacing: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ color: '#818CF8' }}>O</span>
          <span>KAZ</span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 36,
            color: '#94A3B8',
            marginTop: '16px',
            display: 'flex',
          }}
        >
          La bonne affaire en 8 secondes
        </div>

        {/* Sites */}
        <div
          style={{
            display: 'flex',
            gap: '24px',
            marginTop: '48px',
            fontSize: 20,
            color: '#64748B',
          }}
        >
          <span style={{ color: '#F97316' }}>LeBonCoin</span>
          <span>|</span>
          <span style={{ color: '#2DD4BF' }}>Vinted</span>
          <span>|</span>
          <span style={{ color: '#60A5FA' }}>Back Market</span>
          <span>|</span>
          <span style={{ color: '#FBBF24' }}>Amazon</span>
          <span>|</span>
          <span style={{ color: '#F87171' }}>eBay</span>
        </div>

        {/* Badge IA */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '32px',
            padding: '8px 24px',
            borderRadius: '999px',
            background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.3)',
            fontSize: 18,
            color: '#818CF8',
          }}
        >
          Propulsé par l&apos;IA Gemini
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            fontSize: 16,
            color: '#475569',
            display: 'flex',
          }}
        >
          okaz-ia.fr — par Facile-IA
        </div>
      </div>
    ),
    { ...size }
  );
}
