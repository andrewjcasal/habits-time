import { useMemo } from 'react'
import type { RegistryEventType } from '../types'

// Re-export so existing `import { RegistryEventType } from '../hooks/useEventRegistry'`
// call sites keep working. The canonical declaration lives in
// `src/types/calendarEvent.ts`.
export type { RegistryEventType }

export interface EventOperations<T = any> {
  /**
   * Whether this event type supports drag-resize (and any other "change
   * end_time" operation like a "+15m" keyboard shortcut). Pass a function
   * for per-event decisions (e.g. read-only google-calendar imports).
   */
  canResize: boolean | ((event: T) => boolean)

  /**
   * Persist a new end_time and patch local state so the grid reflects the
   * change without a refetch. Pure data — no UI side effects (conflict
   * dialogs, toasts) belong here. Those stay at the call site.
   */
  resize?: (event: T, newEndIso: string) => Promise<void>
}

export type EventRegistry = Record<RegistryEventType, EventOperations<any>>

interface UseEventRegistryDeps {
  updateMeeting: (id: string, patch: any) => Promise<any>
  updateProjectActivity: (id: string, patch: any) => Promise<any>
  updateBillableHour: (id: string, patch: any) => Promise<any>
}

/**
 * Returns a registry mapping event type → operations. The registry is the
 * single place where "how do I write a change for this kind of event"
 * lives. The mousemove/mouseup loop, keyboard shortcuts, and any future
 * extend/duplicate UI all dispatch through it instead of branching on type.
 */
export function useEventRegistry(deps: UseEventRegistryDeps): EventRegistry {
  const { updateMeeting, updateProjectActivity, updateBillableHour } = deps

  return useMemo<EventRegistry>(() => ({
    meeting: {
      canResize: true,
      resize: async (meeting, newEndIso) => {
        await updateMeeting(meeting.id, { end_time: newEndIso })
      },
    },
    'project-activity': {
      canResize: true,
      resize: async (activity, newEndIso) => {
        await updateProjectActivity(activity.id, { end_time: newEndIso })
      },
    },
    'billable-hours': {
      canResize: true,
      // Manual edits flip is_auto_placed off so the placer stops
      // treating this block as a candidate to displace on the next
      // top-up pass.
      resize: async (block, newEndIso) => {
        await updateBillableHour(block.id, { end_time: newEndIso, is_auto_placed: false })
      },
    },
  }), [updateMeeting, updateProjectActivity, updateBillableHour])
}

export const canResize = <T,>(ops: EventOperations<T> | undefined, event: T): boolean => {
  if (!ops) return false
  return typeof ops.canResize === 'function' ? ops.canResize(event) : ops.canResize
}
