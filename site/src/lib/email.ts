// OKAZ - Service Email (Resend)
import { Resend } from 'resend';

// Lazy initialization pour éviter erreur au build
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

const FROM_EMAIL = 'OKAZ <noreply@okaz.facile-ia.com>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Envoie un Magic Link pour connexion
 */
export async function sendMagicLink(email: string, token: string): Promise<boolean> {
  const magicLink = `${APP_URL}/api/auth/verify?token=${token}`;

  try {
    const { error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Connecte-toi à OKAZ',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0f; color: #f8fafc; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto;">
            <h1 style="font-size: 28px; font-weight: bold; background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 24px;">
              OKAZ
            </h1>

            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Clique sur le bouton ci-dessous pour te connecter instantanément.<br>
              Pas de mot de passe, simple comme bonjour.
            </p>

            <a href="${magicLink}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 600; font-size: 16px;">
              Me connecter
            </a>

            <p style="font-size: 13px; color: #94a3b8; margin-top: 32px;">
              Ce lien expire dans 15 minutes.<br>
              Si tu n'as pas demandé ce lien, ignore cet email.
            </p>

            <hr style="border: none; border-top: 1px solid #333; margin: 32px 0;">

            <p style="font-size: 12px; color: #64748b;">
              OKAZ - Comparateur intelligent de petites annonces<br>
              Un projet <a href="https://facile-ia.fr" style="color: #6366f1;">Facile-IA</a>
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('[OKAZ Email] Erreur envoi:', error);
      return false;
    }

    console.log('[OKAZ Email] Magic Link envoyé à:', email);
    return true;

  } catch (error) {
    console.error('[OKAZ Email] Erreur:', error);
    return false;
  }
}

/**
 * Envoie un email de bienvenue Premium
 */
export async function sendWelcomePremium(email: string): Promise<boolean> {
  try {
    const { error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Bienvenue dans OKAZ Premium !',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0f; color: #f8fafc; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto;">
            <h1 style="font-size: 28px; font-weight: bold; background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
              Merci pour ton soutien !
            </h1>

            <p style="font-size: 16px; line-height: 1.6; margin: 24px 0;">
              Tu fais maintenant partie des membres Premium OKAZ.<br>
              Voici ce que tu débloques :
            </p>

            <ul style="font-size: 15px; line-height: 1.8; padding-left: 20px;">
              <li>✓ Recherches illimitées</li>
              <li>✓ Alertes nouvelles annonces</li>
              <li>✓ Historique des prix</li>
              <li>✓ Nego-Coach (aide à la négociation)</li>
              <li>✓ Sans publicité</li>
            </ul>

            <p style="font-size: 14px; color: #94a3b8; margin-top: 32px;">
              Ton abonnement se renouvelle automatiquement dans 1 an.<br>
              Tu peux l'annuler à tout moment depuis ton espace.
            </p>

            <hr style="border: none; border-top: 1px solid #333; margin: 32px 0;">

            <p style="font-size: 12px; color: #64748b;">
              OKAZ - Comparateur intelligent de petites annonces<br>
              Un projet <a href="https://facile-ia.fr" style="color: #6366f1;">Facile-IA</a>
            </p>
          </div>
        </body>
        </html>
      `,
    });

    return !error;

  } catch (error) {
    console.error('[OKAZ Email] Erreur welcome:', error);
    return false;
  }
}
