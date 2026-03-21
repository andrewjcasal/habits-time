import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

async function todoistFetch(url: string, options: RequestInit, apiKey: string) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Todoist API error (${response.status}): ${text}`)
  }
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null
  }
  return response.json()
}

function getRecentReviewLabels(): string[] {
  const labels: string[] = []
  for (let i = 0; i < 5; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    labels.push(`review_${mm}${dd}`)
  }
  return labels
}

function getTodayReviewLabel(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `review_${mm}${dd}`
}

async function addReviewLabel(taskId: string, apiKey: string) {
  const reviewLabel = getTodayReviewLabel()
  const task = await todoistFetch(`https://api.todoist.com/api/v1/tasks/${taskId}`, {}, apiKey)
  const labels = [...(task?.labels || []), reviewLabel]
  await todoistFetch(`https://api.todoist.com/api/v1/tasks/${taskId}`, {
    method: 'POST',
    body: JSON.stringify({ labels }),
  }, apiKey)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { action, taskId, label } = body

    const authHeader = req.headers.get('Authorization')!
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const token = authHeader.replace('Bearer ', '')
    const payload = JSON.parse(atob(token.split('.')[1]))
    const userId = payload.sub
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('todoist_api_key')
      .eq('user_id', userId)
      .single()

    if (settingsError || !settings?.todoist_api_key) {
      return new Response(JSON.stringify({ error: 'No Todoist API key configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = settings.todoist_api_key

    if (action === 'list') {
      const data = await todoistFetch('https://api.todoist.com/api/v1/tasks', {}, apiKey)
      const allTasks = Array.isArray(data) ? data : (data?.results || [])
      console.log('allTasks', allTasks)
      // Find tasks that are parents (have children)
      const parentIds = new Set(allTasks.map((t: any) => t.parent_id).filter(Boolean))
      // Filter out parents and recently reviewed tasks
      const recentLabels = getRecentReviewLabels()
      const tasks = allTasks.filter((t: any) =>
        !parentIds.has(t.id) &&
        !t.labels?.some((l: string) => recentLabels.includes(l))
      )
      return new Response(JSON.stringify({ tasks }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'complete') {
      await todoistFetch(`https://api.todoist.com/api/v1/tasks/${taskId}/close`, { method: 'POST' }, apiKey)
      // No need to add review label since task is completed
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'delete') {
      await todoistFetch(`https://api.todoist.com/api/v1/tasks/${taskId}`, { method: 'DELETE' }, apiKey)
      // No need to add review label since task is deleted
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'add_label') {
      const task = await todoistFetch(`https://api.todoist.com/api/v1/tasks/${taskId}`, {}, apiKey)
      const labels = [...(task?.labels || []), label, getTodayReviewLabel()]
      await todoistFetch(`https://api.todoist.com/api/v1/tasks/${taskId}`, {
        method: 'POST',
        body: JSON.stringify({ labels }),
      }, apiKey)
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'skip') {
      // Skip = reviewed but no action, just tag with review label
      await addReviewLabel(taskId, apiKey)
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
