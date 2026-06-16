import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM || 'La Polla Hipólitos <recordatorios@todoestaaca.com>';

export const resend = resendApiKey ? new Resend(resendApiKey) : null;

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(options: SendEmailOptions) {
  if (!resendApiKey) {
    // Return mock success in non-production environments if API key is not configured
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[EMAIL SIMULATION] Sending email to ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      console.log(`Text: ${options.text}`);
      return { id: 'simulated-msg-id', error: null };
    }
    throw new Error('Resend is not configured (RESEND_API_KEY is missing)');
  }

  if (!resend) {
    throw new Error('Resend client failed to initialize');
  }

  try {
    const data = await resend.emails.send({
      from: emailFrom,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    
    if (data.error) {
      return { id: null, error: data.error };
    }
    
    return { id: data.data?.id || null, error: null };
  } catch (error) {
    console.error('Error sending email via Resend:', error);
    return { id: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
}
