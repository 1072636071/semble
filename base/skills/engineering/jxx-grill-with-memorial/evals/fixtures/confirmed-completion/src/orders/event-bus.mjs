export const EVENTS = Object.freeze({
  orderCreated: 'order.created.v1',
});

export async function publish(eventName, payload, bus) {
  await bus.publish(eventName, payload);
}
