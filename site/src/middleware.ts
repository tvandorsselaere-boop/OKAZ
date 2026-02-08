import { NextRequest, NextResponse } from 'next/server';

// CORS middleware pour permettre à l'extension Chrome d'appeler les API quota
// Les extensions Chrome ont un origin de type chrome-extension://ID
export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const isExtension = origin.startsWith('chrome-extension://');

  // Preflight OPTIONS
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    if (isExtension) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
      response.headers.set('Access-Control-Max-Age', '86400');
    }
    return response;
  }

  // Requêtes normales
  const response = NextResponse.next();
  if (isExtension) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
  return response;
}

// Appliquer uniquement aux routes API quota (pas aux autres routes)
export const config = {
  matcher: '/api/quota/:path*',
};
