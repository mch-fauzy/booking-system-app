export const SuccessMessageConstant = {
  EntityCreated: (name: string) => `${name} created successfully`,
  EntityRetrieved: (name: string) => `${name} retrieved successfully`,
  PaymentSucceeded: () => 'Payment succeeded, booking confirmed',
  PaymentDeclined: () => 'Payment declined, booking not confirmed',
} as const;

export const ErrorMessageConstant = {
  DataEntityNotFound: (name: string) => `${name} not found`,
  ValidationError: () => 'Validation Error',
  ResourceNotFound: () => 'Not Found',
  InternalServerError: () => 'Internal Server Error',
  Conflict: () => 'Resource already exists',
  ClassFull: () => 'Trial class is full',
  DuplicateBooking: () => 'This child already has a booking for this trial class',
  BookingNotPayable: () => 'Booking is not awaiting payment',
} as const;
