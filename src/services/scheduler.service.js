const cron = require('node-cron');
const notificationService = require('./notification.service');

const DUE_DATE_CRON = process.env.NOTIFICATION_DUEDATE_CRON || '0 9 * * *';
const TIMEZONE = process.env.SCHEDULER_TIMEZONE || 'Asia/Seoul';

let duedateTask = null;

function start() {
  if (duedateTask) return duedateTask;

  if (!cron.validate(DUE_DATE_CRON)) {
    console.error(`[scheduler] invalid cron expression: ${DUE_DATE_CRON}`);
    return null;
  }

  duedateTask = cron.schedule(
    DUE_DATE_CRON,
    async () => {
      console.log('[scheduler] Running due-date scan...');
      try {
        const results = await notificationService.runDueDateScan();
        console.log(`[scheduler] Generated ${results.length} notifications`);
      } catch (e) {
        console.error('[scheduler] Due-date scan failed:', e.message);
      }
    },
    { timezone: TIMEZONE }
  );

  console.log(`✅ Notification scheduler started: "${DUE_DATE_CRON}" (${TIMEZONE})`);
  return duedateTask;
}

function stop() {
  if (duedateTask) {
    duedateTask.stop();
    duedateTask = null;
    console.log('[scheduler] Stopped');
  }
}

module.exports = { start, stop };
