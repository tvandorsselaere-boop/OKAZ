import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY non configurée');
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://okaz-ia.fr';

    const { error } = await getResend().emails.send({
      from: 'OKAZ <noreply@okaz-ia.fr>',
      to: email,
      subject: 'OKAZ - Ouvre ce lien sur ton ordinateur',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto;">
            <h1 style="font-size: 32px; font-weight: bold; background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px;">
              OKAZ
            </h1>
            <p style="font-size: 13px; color: #94a3b8; margin-bottom: 32px;">
              Comparateur intelligent de petites annonces
            </p>

            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Tu as demandé le lien depuis ton téléphone.<br>
              Ouvre-le sur ton <strong>ordinateur</strong> pour commencer :
            </p>

            <a href="${appUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; margin-bottom: 24px;">
              Ouvrir OKAZ
            </a>

            <div style="background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 16px; margin: 24px 0;">
              <p style="font-size: 14px; margin: 0 0 12px 0; font-weight: 600;">Comment ça marche :</p>
              <p style="font-size: 14px; color: #cbd5e1; margin: 0; line-height: 1.8;">
                1. Ouvre ce lien sur ton PC ou Mac<br>
                2. Installe l'extension Chrome (1 clic)<br>
                3. Cherche ce que tu veux — l'IA compare 5 sites pour toi
              </p>
            </div>

            <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
              5 sites comparés : LeBonCoin, Vinted, Back Market, Amazon, eBay
            </p>

            <hr style="border: none; border-top: 1px solid #1e293b; margin: 32px 0;">

            <p style="font-size: 12px; color: #64748b;">
              OKAZ — Un projet <a href="https://facile-ia.fr" style="color: #6366f1; text-decoration: none;">Facile-IA</a>
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('[OKAZ] Erreur envoi lien mobile:', error);
      return NextResponse.json({ error: 'Erreur envoi' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[OKAZ] Erreur send-link:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
