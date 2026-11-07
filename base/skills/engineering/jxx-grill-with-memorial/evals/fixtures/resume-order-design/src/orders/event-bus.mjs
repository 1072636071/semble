export const EVENTS = Object.freeze({
  orderCreated: 'order.created.v1',
});

export async function publishOrderCreated(payload, bus) {
  await bus.publish(EVENTS.orderCreated, payload);
}
