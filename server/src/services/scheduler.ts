import cron from 'node-cron';
import { findAll, insert } from '../db/store';
import { sendFollowUpReminder, sendOPTAlert } from './email';

export function startScheduler() {
  const today = () => new Date().toISOString().slice(0, 10);

  // Daily at 9am: send follow-up reminders
  cron.schedule('0 9 * * *', async () => {
    try {
      const jobs = findAll<any>('job_applications', j => j.follow_up_date === today());
      const users = findAll<any>('users');
      const userMap = Object.fromEntries(users.map((u: any) => [u.id, u]));

      for (const job of jobs) {
        const user = userMap[job.user_id];
        if (!user) continue;
        await sendFollowUpReminder(user.email, user.first_name, job.company, job.role);
        insert('notifications', {
          user_id: job.user_id,
          type: 'follow_up_reminder',
          title: `Follow up on ${job.company}`,
          message: `Time to follow up on your ${job.role} application at ${job.company}`,
          read: false,
        });
      }
    } catch (err) {
      console.error('Follow-up reminder job failed:', err);
    }
  });

  // Daily at 8am: OPT compliance alerts
  cron.schedule('0 8 * * *', async () => {
    try {
      const records = findAll<any>('opt_compliance', r => !!r.opt_end_date);
      const users = findAll<any>('users');
      const userMap = Object.fromEntries(users.map((u: any) => [u.id, u]));

      for (const r of records) {
        const user = userMap[r.user_id];
        if (!user) continue;
        const daysUntilEnd = Math.floor((new Date(r.opt_end_date).getTime() - Date.now()) / 86400000);
        const unemploymentRemaining = 90 - (r.unemployment_days_used || 0);

        if ([30, 14, 7, 1].includes(daysUntilEnd)) {
          await sendOPTAlert(user.email, user.first_name, 'opt_expiring', daysUntilEnd);
          insert('notifications', {
            user_id: r.user_id,
            type: 'opt_alert',
            title: 'OPT Expiring Soon',
            message: `Your OPT expires in ${daysUntilEnd} days`,
            read: false,
          });
        }

        if (unemploymentRemaining <= 30 && unemploymentRemaining > 0) {
          if ([30, 14, 7].includes(unemploymentRemaining)) {
            await sendOPTAlert(user.email, user.first_name, 'unemployment_warning', unemploymentRemaining);
          }
        }
      }
    } catch (err) {
      console.error('OPT alert job failed:', err);
    }
  });

  console.log('Scheduler started');
}
