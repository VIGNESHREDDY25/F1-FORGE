import sgMail from '@sendgrid/mail';
import { config } from '../config';

sgMail.setApiKey(config.sendgrid.apiKey);

export async function sendFollowUpReminder(to: string, name: string, company: string, role: string) {
  await sgMail.send({
    to,
    from: config.sendgrid.fromEmail,
    subject: `F1Forge: Follow up on your application at ${company}`,
    html: `
      <h2>Time to Follow Up!</h2>
      <p>Hi ${name},</p>
      <p>You set a follow-up reminder for your <strong>${role}</strong> application at <strong>${company}</strong>.</p>
      <p>This is a great time to send a quick check-in email to the recruiter.</p>
      <p><a href="${config.clientUrl}/jobs">View your applications</a></p>
      <p>— F1Forge Team</p>
    `,
  });
}

export async function sendOPTAlert(to: string, name: string, alertType: string, daysRemaining: number) {
  const messages: Record<string, string> = {
    unemployment_warning: `You have used ${90 - daysRemaining} of your 90 allowed unemployment days on OPT.`,
    opt_expiring: `Your OPT authorization expires in ${daysRemaining} days.`,
    stem_opt_window: `Your STEM OPT extension application window opens in ${daysRemaining} days.`,
  };

  await sgMail.send({
    to,
    from: config.sendgrid.fromEmail,
    subject: `F1Forge: Important OPT Compliance Alert`,
    html: `
      <h2>OPT Compliance Alert</h2>
      <p>Hi ${name},</p>
      <p>${messages[alertType] || 'Please review your OPT compliance status.'}</p>
      <p><strong>Action required:</strong> Please log in to review your compliance dashboard.</p>
      <p><a href="${config.clientUrl}/compliance">View Compliance Dashboard</a></p>
      <p>— F1Forge Team</p>
    `,
  });
}

export async function sendWelcomeEmail(to: string, name: string) {
  await sgMail.send({
    to,
    from: config.sendgrid.fromEmail,
    subject: 'Welcome to F1Forge — Your International Student Career Hub',
    html: `
      <h2>Welcome to F1Forge, ${name}!</h2>
      <p>We're here to help you navigate the F1 visa job search with confidence.</p>
      <h3>Get started:</h3>
      <ul>
        <li>Complete your profile to unlock all features</li>
        <li>Add your first job application</li>
        <li>Set up your OPT compliance tracker</li>
        <li>Try the AI Career Assistant</li>
      </ul>
      <p><a href="${config.clientUrl}/onboarding">Complete Onboarding</a></p>
      <p>— F1Forge Team</p>
    `,
  });
}
