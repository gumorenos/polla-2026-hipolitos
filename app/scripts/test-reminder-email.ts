import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { sendEmail } from '../src/lib/email';

function maskEmail(email: string): string {
  if (!email) return 'NO_EMAIL';
  const parts = email.split('@');
  if (parts.length !== 2) return 'INVALID_EMAIL';
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) {
    return `${name[0]}***@${domain}`;
  }
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

async function main() {
  console.log('==================================================');
  console.log('      LA POLLA 2026 - TEST EMAIL REMINDER         ');
  console.log('==================================================\n');

  // Argument parsing
  const toArg = process.argv.find((arg) => arg.startsWith('--to='));
  const toEmail = toArg ? toArg.split('=')[1] : null;

  if (!toEmail) {
    console.error('Error: Debes especificar el correo de destino con --to=tu@correo.com');
    process.exit(1);
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error('Error: RESEND_API_KEY no está configurado en las variables de entorno.');
    process.exit(1);
  }

  console.log(`Enviando correo de prueba a: ${maskEmail(toEmail)}...`);

  try {
    const res = await sendEmail({
      to: toEmail,
      subject: 'Prueba de recordatorios - La Polla Hipólitos',
      text: 'Este es un correo de prueba de La Polla Hipólitos.',
      html: '<p>Este es un correo de prueba de La Polla Hipólitos.</p>',
    });

    if (res.error) {
      const errMsg = res.error instanceof Error ? res.error.message : JSON.stringify(res.error);
      console.error(`Error al enviar el correo de prueba: ${errMsg}`);
      process.exit(1);
    }

    console.log(`¡Correo de prueba enviado con éxito!`);
    console.log(`Provider Message ID: ${res.id}`);
  } catch (error) {
    console.error('Error inesperado al enviar el correo de prueba:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('Fallo crítico en script de prueba de correo:', e);
    process.exit(1);
  });
