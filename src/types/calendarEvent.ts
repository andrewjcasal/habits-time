/**
 * The set of calendar event types that participate in the registry.
 * Extend this union (and `useEventRegistry`) when a new event type adopts
 * the registry. Types not in the registry continue to use their bespoke
 * wiring.
 */
export type RegistryEventType = 'meeting' | 'project-activity' | 'billable-hours'
