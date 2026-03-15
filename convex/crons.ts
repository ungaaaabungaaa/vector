import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

crons.cron(
  'sync disposable signup domains',
  '0 3 * * *',
  internal.platformAdmin.actions.syncDisposableEmailDomains,
  {},
);

crons.interval(
  'reconcile github artifacts',
  { minutes: 10 },
  internal.github.actions.reconcileRecentArtifacts,
  {},
);

export default crons;
