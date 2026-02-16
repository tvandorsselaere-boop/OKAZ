'use client';

import { useState, useEffect } from 'react';

interface CookieConsent {
  essential: boolean;
  analytics: boolean;
  date: string;
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem('okaz_consent');
      if (!consent) {
        setVisible(true);
      }
    } catch {
      // localStorage indisponible (SSR, iframe restreint, etc.)
    }
  }, []);

  const handleAccept = () => {
    const consent: CookieConsent = {
      essential: true,
      analytics: true,
      date: new Date().toISOString(),
    };
    localStorage.setItem('okaz_consent', JSON.stringify(consent));
    setVisible(false);
  };

  const handleRefuse = () => {
    const consent: CookieConsent = {
      essential: true,
      analytics: false,
      date: new Date().toISOString(),
    };
    localStorage.setItem('okaz_consent', JSON.stringify(consent));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: 'var(--card-bg)',
        borderTop: '1px solid var(--separator)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        flexWrap: 'wrap' as const,
      }}
    >
      <p
        style={{
          color: 'var(--text-secondary)',
          fontSize: '13px',
          lineHeight: 1.5,
          margin: 0,
          maxWidth: '600px',
        }}
      >
        OKAZ utilise des cookies essentiels pour fonctionner.{' '}
        <a
          href="/privacy"
          style={{ color: 'var(--accent)', textDecoration: 'underline' }}
        >
          En savoir plus
        </a>
      </p>
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button
          onClick={handleRefuse}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            border: '1px solid var(--separator)',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Refuser
        </button>
        <button
          onClick={handleAccept}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: 'var(--accent)',
            color: '#fff',
            fontSize: '13px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Accepter
        </button>
      </div>
    </div>
  );
}
