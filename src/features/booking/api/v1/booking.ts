import 'server-only';
import { Hono } from 'hono';
import { bookingService } from '@/features/booking/services/booking';
import { createBookingSchema } from '@/features/booking/dtos/v1/requests/create-booking';
import { payBookingSchema } from '@/features/booking/dtos/v1/requests/pay-booking';
import { idParamSchema } from '@/shared/dtos/requests/id-param';
import { ok } from '@/shared/utils/response/response';
import { SuccessMessageConstant } from '@/shared/constants/messages';
import { BOOKING_STATUS } from '@/shared/constants/booking-status';
import { validate } from '@/shared/lib/validation/validation';

export const bookingRouter = new Hono();

bookingRouter.post('/', validate('json', createBookingSchema), async (c) => {
  const booking = await bookingService.create(c.req.valid('json'));
  return c.json(ok(booking, SuccessMessageConstant.EntityCreated('Booking')), 201);
});

bookingRouter.get('/:id', validate('param', idParamSchema), async (c) => {
  const { id } = c.req.valid('param');
  return c.json(ok(await bookingService.getById(id), SuccessMessageConstant.EntityRetrieved('Booking')));
});

// A payment attempt is a created sub-resource: 201 for both a succeeded and a declined charge.
bookingRouter.post(
  '/:id/payments',
  validate('param', idParamSchema),
  validate('json', payBookingSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const booking = await bookingService.pay(id, c.req.valid('json'));
    const message = booking.status === BOOKING_STATUS.CONFIRMED
      ? SuccessMessageConstant.PaymentSucceeded()
      : SuccessMessageConstant.PaymentDeclined();
    return c.json(ok(booking, message), 201);
  },
);
