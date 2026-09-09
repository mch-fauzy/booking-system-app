import { handle } from 'hono/vercel';
import { app, v1 } from '@/shared/lib/api/api';
import { trialClassRouter } from '@/features/trial-class/api/v1/trial-class';
import { bookingRouter } from '@/features/booking/api/v1/booking';

v1.route('/trial-classes', trialClassRouter);
v1.route('/bookings', bookingRouter);
app.route('/v1', v1);

// Node runtime: the neon-serverless WebSocket driver is incompatible with edge.
export const runtime = 'nodejs';

export const GET = handle(app);
export const POST = handle(app);
