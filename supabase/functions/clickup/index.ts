import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// ClickUp personal API tokens go in the Authorization header as a raw token
// (not Bearer). See https://clickup.com/api (v2 auth).
async function clickupFetch(url: string, options: RequestInit, apiKey: string) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`ClickUp API error (${response.status}): ${text}`)
  }
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null
  }
  return response.json()
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startedAt = Date.now()
  try {
    const body = await req.json() as {
      action: string
      taskId?: string
      dueDate?: string | null
      durationMinutes?: number
    }
    const { action, taskId, dueDate, durationMinutes } = body
    console.log('[clickup] request', { action, taskId })

    const authHeader = req.headers.get('Authorization')!
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const token = authHeader.replace('Bearer ', '')
    const payload = JSON.parse(atob(token.split('.')[1]))
    const userId = payload.sub
    if (!userId) {
      console.warn('[clickup] unauthorized: no sub in token')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    console.log('[clickup] auth ok', { userId })

    const { data: settings, error: settingsError } = await supabase
      .from('cassian_user_settings')
      .select('clickup_api_key')
      .eq('user_id', userId)
      .single()

    if (settingsError || !settings?.clickup_api_key) {
      console.warn('[clickup] no api key configured', { settingsError: settingsError?.message })
      return new Response(JSON.stringify({ error: 'No ClickUp API key configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = settings.clickup_api_key as string
    console.log('[clickup] loaded api key from settings', { length: apiKey.length })

    if (action === 'list_all') {
      console.log('[clickup] list_all: resolving current user')
      const me = await clickupFetch('https://api.clickup.com/api/v2/user', {}, apiKey)
      const clickupUserId: number = me?.user?.id
      console.log('[clickup] resolved clickup user', {
        clickupUserId,
        username: me?.user?.username,
        email: me?.user?.email,
      })
      if (!clickupUserId) {
        console.error('[clickup] could not resolve clickup user id', { me })
        return new Response(JSON.stringify({ error: 'Could not resolve ClickUp user id' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Load the user's enabled list ids. If nothing is toggled on we
      // return an empty task list — better than silently pulling the whole
      // workspace.
      const { data: enabledRows } = await supabase
        .from('cassian_clickup_lists')
        .select('clickup_list_id, clickup_team_id')
        .eq('user_id', userId)
        .eq('is_enabled', true)
      const enabledListIds = (enabledRows || []).map((r: any) => r.clickup_list_id as string)
      console.log('[clickup] enabled lists', { count: enabledListIds.length })
      if (enabledListIds.length === 0) {
        return new Response(
          JSON.stringify({ tasks: [], user_id: clickupUserId, warning: 'No ClickUp lists are enabled. Toggle lists on in the calendar settings modal.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      console.log('[clickup] fetching teams')
      const teamsRes = await clickupFetch('https://api.clickup.com/api/v2/team', {}, apiKey)
      const teams: any[] = teamsRes?.teams || []
      console.log('[clickup] teams', {
        count: teams.length,
        names: teams.map((t: any) => t.name),
      })

      // Fetch open tasks in two passes per team, scoped to the enabled
      // lists, and merge by task id. Pass 1: assigned to the current user.
      // Pass 2: all open tasks, then keep only unassigned ones — so the
      // user sees both their queue and work that's up for grabs.
      const fetchTeamTasks = async (
        team: any,
        params: URLSearchParams,
        label: string,
        keep: (task: any) => boolean = () => true
      ) => {
        const collected: any[] = []
        let page = 0
        while (true) {
          const p = new URLSearchParams(params)
          p.set('page', String(page))
          const url = `https://api.clickup.com/api/v2/team/${team.id}/task?${p.toString()}`
          console.log('[clickup] fetching team tasks', { team: team.name, label, page })
          const res = await clickupFetch(url, {}, apiKey)
          const tasks: any[] = res?.tasks || []
          const kept = tasks.filter(keep)
          console.log('[clickup] team page result', {
            team: team.name,
            label,
            page,
            returned: tasks.length,
            kept: kept.length,
          })
          for (const t of kept) {
            collected.push({ ...t, team_id: team.id, team_name: team.name })
          }
          if (tasks.length < 100) break
          page += 1
          if (page > 50) {
            console.warn('[clickup] pagination safety cap hit', { team: team.name, label })
            break
          }
        }
        return collected
      }

      const byId = new Map<string, any>()
      for (const team of teams) {
        const baseParams = new URLSearchParams({
          include_closed: 'false',
          subtasks: 'true',
        })
        for (const id of enabledListIds) baseParams.append('list_ids[]', id)

        // Pass 1 — assigned to me.
        const assignedParams = new URLSearchParams(baseParams)
        assignedParams.append('assignees[]', String(clickupUserId))
        const mine = await fetchTeamTasks(team, assignedParams, 'assigned-to-me')
        for (const t of mine) byId.set(t.id, t)

        // Pass 2 — all open tasks, then keep only unassigned.
        const unassigned = await fetchTeamTasks(
          team,
          baseParams,
          'unassigned',
          (t: any) => !t.assignees || t.assignees.length === 0
        )
        for (const t of unassigned) {
          if (!byId.has(t.id)) byId.set(t.id, t)
        }

        console.log('[clickup] team done', {
          team: team.name,
          mine: mine.length,
          unassigned: unassigned.length,
        })
      }
      const allTasks = Array.from(byId.values())

      console.log('[clickup] list_all done', {
        totalTasks: allTasks.length,
        ms: Date.now() - startedAt,
      })
      return new Response(JSON.stringify({ tasks: allTasks, user_id: clickupUserId }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'list_spaces') {
      console.log('[clickup] list_spaces: fetching teams')
      const teamsRes = await clickupFetch('https://api.clickup.com/api/v2/team', {}, apiKey)
      const teams: any[] = teamsRes?.teams || []
      const result: any[] = []
      for (const team of teams) {
        const spacesUrl = `https://api.clickup.com/api/v2/team/${team.id}/space?archived=false`
        const spacesRes = await clickupFetch(spacesUrl, {}, apiKey)
        const spaces: any[] = spacesRes?.spaces || []
        console.log('[clickup] team spaces', { team: team.name, count: spaces.length })

        const spacesOut: any[] = []
        for (const space of spaces) {
          // Folderless lists — lists that live directly under the space.
          const folderlessRes = await clickupFetch(
            `https://api.clickup.com/api/v2/space/${space.id}/list?archived=false`,
            {},
            apiKey
          )
          const folderlessLists: any[] = folderlessRes?.lists || []

          // Folder-nested lists — each folder includes its lists in the
          // same payload.
          const foldersRes = await clickupFetch(
            `https://api.clickup.com/api/v2/space/${space.id}/folder?archived=false`,
            {},
            apiKey
          )
          const folders: any[] = foldersRes?.folders || []

          console.log('[clickup] space lists', {
            space: space.name,
            folderless: folderlessLists.length,
            folders: folders.length,
          })

          spacesOut.push({
            id: space.id,
            name: space.name,
            color: space.color || null,
            lists: folderlessLists.map((l: any) => ({ id: l.id, name: l.name })),
            folders: folders.map((f: any) => ({
              id: f.id,
              name: f.name,
              lists: (f.lists || []).map((l: any) => ({ id: l.id, name: l.name })),
            })),
          })
        }

        result.push({
          team_id: team.id,
          team_name: team.name,
          spaces: spacesOut,
        })
      }

      // Merge the user's saved is_enabled state onto every returned list so
      // the UI can render toggles in the right position without a second
      // round-trip.
      const { data: savedRows } = await supabase
        .from('cassian_clickup_lists')
        .select('clickup_list_id, is_enabled')
        .eq('user_id', userId)
      const enabledMap = new Map<string, boolean>(
        (savedRows || []).map((r: any) => [r.clickup_list_id, r.is_enabled])
      )
      const annotate = (l: any) => ({
        ...l,
        is_enabled: enabledMap.has(l.id) ? enabledMap.get(l.id)! : false,
      })
      for (const team of result) {
        for (const space of team.spaces) {
          space.lists = space.lists.map(annotate)
          for (const folder of space.folders) {
            folder.lists = folder.lists.map(annotate)
          }
        }
      }

      console.log('[clickup] list_spaces done', { ms: Date.now() - startedAt })
      return new Response(JSON.stringify({ teams: result }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'update' && taskId) {
      // Push user edits back to ClickUp. due_date is milliseconds since
      // epoch (or null to clear). time_estimate is milliseconds.
      const patch: Record<string, any> = {}
      if (dueDate !== undefined) {
        if (dueDate === null || dueDate === '') {
          patch.due_date = null
        } else {
          // Convert yyyy-MM-dd → ms at local noon so timezones don't roll
          // the date across midnight.
          const [y, m, d] = dueDate.split('-').map(Number)
          patch.due_date = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0).getTime()
          patch.due_date_time = false
        }
      }
      if (typeof durationMinutes === 'number') {
        patch.time_estimate = Math.max(0, Math.round(durationMinutes * 60 * 1000))
      }
      console.log('[clickup] update', { taskId, patch })
      if (Object.keys(patch).length > 0) {
        await clickupFetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
          method: 'PUT',
          body: JSON.stringify(patch),
        }, apiKey)
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'complete' && taskId) {
      console.log('[clickup] complete: closing task', { taskId })
      await clickupFetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'closed' }),
      }, apiKey)
      console.log('[clickup] complete done', { taskId, ms: Date.now() - startedAt })

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.warn('[clickup] unknown action', { action })
    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[clickup] function error', { message, ms: Date.now() - startedAt })
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
