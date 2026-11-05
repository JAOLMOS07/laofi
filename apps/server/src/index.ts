import { createApp } from './app.js';
import { prisma } from './db.js';
import { env } from './env.js';
import { startMeetingJob } from './jobs/meetings.js';
import { startRetentionJob } from './jobs/retention.js';

const { http, game } = createApp({ singlePort: env.production });
if (env.production) {
  await game.listen(env.port, '0.0.0.0');
} else {
  await game.listen(env.wsPort);
  await http.listen({ port: env.apiPort, host: '0.0.0.0' });
}
const stopJob = startRetentionJob();
const stopMeetings = startMeetingJob();
console.log(
  env.production
    ? `[la-ofi] en el puerto ${env.port}`
    : `[la-ofi] multijugador en ws://localhost:${env.wsPort} · API en http://localhost:${env.apiPort}`,
);

const shutdown = (): void => {
  stopJob();
  stopMeetings();
  void Promise.allSettled([game.gracefullyShutdown(false), http.close()])
    .then(() => prisma.$disconnect())
    .then(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
