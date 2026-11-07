export const legacyCreateOrderRoute = {
  method: 'POST',
  path: '/orders',
  consumers: ['billing', 'audit', 'admin'],
};
