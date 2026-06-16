import './load-env';
import { prisma } from '../src/lib/db';
import { sendEmail } from '../src/lib/email';

// America/Lima offset is UTC-5
const LIMA_OFFSET_MS = -5 * 60 * 60 * 1000;

function maskEmail(email: string): string {
  if (!email) return 'NO_EMAIL';
  if (email.endsWith('@polla.local')) return 'PLACEHOLDER_EMAIL';
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
  console.log('      LA POLLA 2026 - EMAIL REMINDERS SENDER      ');
  console.log('==================================================\n');

  // Diagnostics
  const resendApiKey = process.env.RESEND_API_KEY;
  console.log(`RESEND_API_KEY: ${resendApiKey ? 'present' : 'missing'}`);
  console.log(`REMINDERS_ENABLED: ${process.env.REMINDERS_ENABLED}`);
  console.log(`EMAIL_REMINDERS_ENABLED: ${process.env.EMAIL_REMINDERS_ENABLED}`);
  console.log(`EMAIL_FROM: ${process.env.EMAIL_FROM || 'not set'}`);
  console.log('');

  // Argument parsing
  const dryRunArg = process.argv.find((arg) => arg === '--dryRun' || arg === '--dry-run');
  const dryRun = !!dryRunArg;

  const testEmailArg = process.argv.find((arg) => arg.startsWith('--testEmail=') || arg.startsWith('--test-email='));
  const testEmail = testEmailArg ? testEmailArg.split('=')[1] : null;

  // 1. Check dry run / test email mode
  if (testEmail) {
    console.log(`[TEST MODE] Sending test email to: ${maskEmail(testEmail)}`);
    if (dryRun) {
      console.log(`[DRY RUN] Would send test email to ${testEmail}`);
      process.exit(0);
    }
    const res = await sendEmail({
      to: testEmail,
      subject: 'La Polla 2026 - Correo de Prueba',
      text: 'Este es un correo de prueba del sistema de recordatorios de La Polla Hipólitos 2026.',
      html: '<p>Este es un correo de prueba del sistema de recordatorios de La Polla Hipólitos 2026.</p>'
    });
    if (res.error) {
      console.error('Test email failed:', res.error);
      process.exit(1);
    }
    console.log('Test email sent successfully! Message ID:', res.id);
    process.exit(0);
  }

  // 2. Load configurations
  const remindersEnabled = process.env.REMINDERS_ENABLED === 'true';
  const emailRemindersEnabled = process.env.EMAIL_REMINDERS_ENABLED === 'true';

  if (!remindersEnabled) {
    console.log('Reminders system (REMINDERS_ENABLED) is NOT enabled. Exiting safely.');
    process.exit(0);
  }

  if (!emailRemindersEnabled) {
    console.log('Email reminders (EMAIL_REMINDERS_ENABLED) is NOT enabled. Exiting safely.');
    process.exit(0);
  }

  const reminderMinutes = parseInt(process.env.REMINDER_MINUTES_BEFORE_DEADLINE || '30');
  const appUrl = process.env.APP_URL || 'https://pollahipolitos.todoestaaca.com';
  const batchLimit = parseInt(process.env.REMINDERS_BATCH_LIMIT || '50');

  console.log(`Configured reminder window: ${reminderMinutes} minutes`);
  console.log(`App URL: ${appUrl}`);
  console.log(`Batch limit: ${batchLimit}`);
  if (dryRun) console.log('*** DRY RUN MODE ENABLED - No emails will be sent, logs will use status dry_run ***');
  console.log('');

  // 3. Find today's matches in America/Lima
  let nowUtc = new Date();
  const nowArg = process.argv.find((arg) => arg.startsWith('--now='));
  if (nowArg) {
    const val = nowArg.split('=')[1];
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      nowUtc = parsed;
      console.log(`[NOW OVERRIDE] Simulating current UTC time: ${nowUtc.toISOString()}`);
    } else {
      console.error(`[WARN] Invalid --now date value: "${val}". Using system clock.`);
    }
  }
  const nowLima = new Date(nowUtc.getTime() + LIMA_OFFSET_MS);

  const year = nowLima.getUTCFullYear();
  const month = nowLima.getUTCMonth();
  const day = nowLima.getUTCDate();

  // Start of Lima day: YYYY-MM-DD 00:00:00 Lima time = YYYY-MM-DD 05:00:00 UTC
  const startOfTodayUtc = new Date(Date.UTC(year, month, day, 5, 0, 0));
  // End of Lima day: YYYY-MM-DD 23:59:59 Lima time = next day 04:59:59 UTC
  const endOfTodayUtc = new Date(startOfTodayUtc.getTime() + 24 * 60 * 60 * 1000 - 1000);

  console.log(`Querying matches for Lima date: ${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  console.log(`UTC Bounds: ${startOfTodayUtc.toISOString()} to ${endOfTodayUtc.toISOString()}`);

  const matches = await prisma.match.findMany({
    where: {
      kickoffUtc: {
        gte: startOfTodayUtc,
        lte: endOfTodayUtc,
      },
    },
    orderBy: { kickoffUtc: 'asc' },
  });

  console.log(`Found ${matches.length} matches scheduled for today.`);

  // 4. Filter matches in the reminder window (e.g. kickoff is between now and now + 30 mins)
  const windowMs = reminderMinutes * 60 * 1000;
  const eligibleMatches = matches.filter((m) => {
    const kickoffTime = new Date(m.kickoffUtc).getTime();
    const diff = kickoffTime - nowUtc.getTime();
    // Match starts in the future, and kickoff is within 30 minutes
    return diff > 0 && diff <= windowMs;
  });

  console.log(`Found ${eligibleMatches.length} matches inside the reminder window.`);

  let totalEmailsSent = 0;
  let totalEmailsFailed = 0;
  let totalSkippedAlreadySent = 0;
  let totalSkippedAlreadyPredicted = 0;
  let totalSkippedNotOptedIn = 0;

  for (const match of eligibleMatches) {
    console.log(`\nProcessing Match ${match.id}: ${match.homeTeamCode} vs ${match.awayTeamCode} (Kickoff: ${match.kickoffUtc.toISOString()})`);

    // Get active leagues
    const leagues = await prisma.league.findMany({
      where: { status: 'active' },
    });

    for (const league of leagues) {
      // Find all approved users in this league
      const members = await prisma.leagueMember.findMany({
        where: {
          leagueId: league.id,
          user: {
            status: 'approved',
          },
        },
        include: {
          user: true,
        },
      });

      for (const member of members) {
        const user = member.user;
        const targetEmail = user.reminderEmail;
        const masked = maskEmail(targetEmail || '');

        // Check unique ReminderLog first to avoid duplicates
        const existingLog = await prisma.reminderLog.findUnique({
          where: {
            userId_leagueId_matchId_reminderType_channel: {
              userId: user.id,
              leagueId: league.id,
              matchId: match.id,
              reminderType: 'match_prediction_deadline',
              channel: 'email',
            },
          },
        });

        if (existingLog) {
          totalSkippedAlreadySent++;
          continue;
        }

        // Check if user is opted in and has real email
        const optedIn = user.remindersEnabled && user.emailRemindersEnabled;

        if (!optedIn || !targetEmail) {
          totalSkippedNotOptedIn++;
          continue;
        }

        // Check if prediction already exists for this match/user/league
        const prediction = await prisma.prediction.findUnique({
          where: {
            userId_leagueId_matchId: {
              userId: user.id,
              leagueId: league.id,
              matchId: match.id,
            },
          },
        });

        if (prediction) {
          totalSkippedAlreadyPredicted++;
          
          // Write log as skipped so we don't query again next time
          if (!dryRun) {
            await prisma.reminderLog.create({
              data: {
                userId: user.id,
                leagueId: league.id,
                matchId: match.id,
                reminderType: 'match_prediction_deadline',
                channel: 'email',
                scheduledFor: match.kickoffUtc,
                status: 'skipped',
                provider: 'resend',
                errorMessage: 'prediction_exists',
              },
            });
          }
          continue;
        }

        // Check batch limit
        if (totalEmailsSent >= batchLimit) {
          console.log(`[WARN] Batch limit of ${batchLimit} reached. Stopping for this run.`);
          break;
        }

        // Send email
        const deadlineLima = new Date(match.kickoffUtc).toLocaleString('es-PE', {
          timeZone: 'America/Lima',
          hour12: true,
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }) + ' (Hora Lima)';

        const subject = 'Te queda poco para enviar tu predicción';
        const textBody = `Hola ${user.displayName || user.name},

Te recordamos que el partido ${match.homeTeamCode} vs ${match.awayTeamCode} cierra a las ${deadlineLima}.

Aún no has enviado tu predicción.

Entra aquí para enviarla:
${appUrl}/pronosticos

Este recordatorio se envió porque lo activaste en tu perfil. Puedes desactivarlo cuando quieras desde tu cuenta.`;

        const htmlBody = `<p>Hola <strong>${user.displayName || user.name}</strong>,</p>
<p>Te recordamos que el partido <strong>${match.homeTeamCode} vs ${match.awayTeamCode}</strong> cierra a las <strong>${deadlineLima}</strong>.</p>
<p>Aún no has enviado tu predicción.</p>
<p>Entra aquí para enviarla:<br/>
<a href="${appUrl}/pronosticos" style="display:inline-block; padding: 10px 20px; background-color: #D4A843; color: #0A0A0F; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">Enviar predicción</a></p>
<hr/>
<p style="font-size: 11px; color: #8A8A9A;">Este recordatorio se envió porque lo activaste en tu perfil. Puedes desactivarlo cuando quieras desde tu cuenta.</p>`;

        console.log(`Sending reminder email to: ${masked} for match ${match.homeTeamCode} vs ${match.awayTeamCode}`);

        if (dryRun) {
          totalEmailsSent++;
          await prisma.reminderLog.create({
            data: {
              userId: user.id,
              leagueId: league.id,
              matchId: match.id,
              reminderType: 'match_prediction_deadline',
              channel: 'email',
              scheduledFor: match.kickoffUtc,
              status: 'dry_run',
              provider: 'resend',
              sentAt: new Date(),
            },
          });
          continue;
        }

        try {
          const emailRes = await sendEmail({
            to: targetEmail,
            subject,
            text: textBody,
            html: htmlBody,
          });

          if (emailRes.error) {
            totalEmailsFailed++;
            const errMsg = emailRes.error instanceof Error ? emailRes.error.message : JSON.stringify(emailRes.error);
            console.error(`Failed to send email to ${masked}: ${errMsg}`);
            
            await prisma.reminderLog.create({
              data: {
                userId: user.id,
                leagueId: league.id,
                matchId: match.id,
                reminderType: 'match_prediction_deadline',
                channel: 'email',
                scheduledFor: match.kickoffUtc,
                status: 'failed',
                provider: 'resend',
                errorMessage: errMsg,
              },
            });
          } else {
            totalEmailsSent++;
            console.log(`Successfully sent email reminder to ${masked}. Message ID: ${emailRes.id}`);
            
            await prisma.reminderLog.create({
              data: {
                userId: user.id,
                leagueId: league.id,
                matchId: match.id,
                reminderType: 'match_prediction_deadline',
                channel: 'email',
                scheduledFor: match.kickoffUtc,
                status: 'sent',
                provider: 'resend',
                providerMessageId: emailRes.id,
                sentAt: new Date(),
              },
            });
          }
        } catch (err) {
          totalEmailsFailed++;
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`Exception sending email to ${masked}: ${errMsg}`);
          
          await prisma.reminderLog.create({
            data: {
              userId: user.id,
              leagueId: league.id,
              matchId: match.id,
              reminderType: 'match_prediction_deadline',
              channel: 'email',
              scheduledFor: match.kickoffUtc,
              status: 'failed',
              provider: 'resend',
              errorMessage: errMsg,
            },
          });
        }
      }
    }
  }

  console.log('\n--- Email Reminders Summary ---');
  console.log(`Matches Checked:             ${eligibleMatches.length}`);
  console.log(`Reminders Sent successfully: ${totalEmailsSent}`);
  console.log(`Reminders Failed:            ${totalEmailsFailed}`);
  console.log(`Skipped (Already Predicted):  ${totalSkippedAlreadyPredicted}`);
  console.log(`Skipped (Already Sent Log):   ${totalSkippedAlreadySent}`);
  console.log(`Skipped (Not Opted-in):      ${totalSkippedNotOptedIn}`);
  console.log('-------------------------------\n');
  console.log('Finished send-reminders script.');
}

main()
  .catch((e) => {
    console.error('Critical failure in send-reminders:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
