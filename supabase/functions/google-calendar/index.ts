import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly'

function getSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

function getUserIdFromToken(req: Request): string | null {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.sub || null
  } catch {
    return null
  }
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) return null
  return res.json()
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { action, code, redirectUri, calendarId, timeMin, timeMax, userCalendarId } = body
    const userId = getUserIdFromToken(req)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = getSupabaseClient()

    // Generate OAuth URL
    if (action === 'authorize') {
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPES,
        access_type: 'offline',
        prompt: 'consent',
      })
      return new Response(JSON.stringify({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Exchange auth code for tokens
    if (action === 'callback') {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      })

      if (!tokenRes.ok) {
        const err = await tokenRes.text()
        return new Response(JSON.stringify({ error: `Token exchange failed: ${err}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const tokens = await tokenRes.json()
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

      // Fetch calendar list
      const calListRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      const calList = await calListRes.json()

      // Insert calendars
      const calendars = (calList.items || []).map((cal: any) => ({
        user_id: userId,
        provider: 'google',
        calendar_id: cal.id,
        name: cal.summary || cal.id,
        color: cal.backgroundColor || null,
        is_enabled: cal.primary || false,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
      }))

      if (calendars.length > 0) {
        // Upsert to handle re-authorization
        for (const cal of calendars) {
          const { data: existing } = await supabase
            .from('cassian_user_calendars')
            .select('id')
            .eq('user_id', userId)
            .eq('calendar_id', cal.calendar_id)
            .maybeSingle()

          if (existing) {
            await supabase.from('cassian_user_calendars')
              .update({ access_token: cal.access_token, refresh_token: cal.refresh_token, token_expires_at: cal.token_expires_at, name: cal.name, color: cal.color })
              .eq('id', existing.id)
          } else {
            await supabase.from('cassian_user_calendars').insert(cal)
          }
        }
      }

      return new Response(JSON.stringify({ success: true, calendars: calendars.map((c: any) => ({ name: c.name, calendar_id: c.calendar_id, color: c.color, is_enabled: c.is_enabled })) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // List connected calendars
    if (action === 'list_calendars') {
      const { data } = await supabase
        .from('cassian_user_calendars')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'google')
        .order('name')

      return new Response(JSON.stringify({ calendars: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Sync events from a specific calendar
    if (action === 'sync_events') {
      const { data: calendar } = await supabase
        .from('cassian_user_calendars')
        .select('*')
        .eq('id', userCalendarId)
        .eq('user_id', userId)
        .single()

      if (!calendar) {
        return new Response(JSON.stringify({ error: 'Calendar not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Refresh token if expired
      let accessToken = calendar.access_token
      if (new Date(calendar.token_expires_at) < new Date()) {
        const refreshed = await refreshAccessToken(calendar.refresh_token)
        if (refreshed) {
          accessToken = refreshed.access_token
          await supabase.from('cassian_user_calendars')
            .update({
              access_token: refreshed.access_token,
              token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
            })
            .eq('id', calendar.id)
        } else {
          return new Response(JSON.stringify({ error: 'Token refresh failed. Please reconnect.' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      // Fetch events
      const params = new URLSearchParams({
        timeMin: timeMin || new Date(Date.now() - 7 * 86400000).toISOString(),
        timeMax: timeMax || new Date(Date.now() + 14 * 86400000).toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
      })

      const eventsRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.calendar_id)}/events?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )

      if (!eventsRes.ok) {
        const err = await eventsRes.text()
        return new Response(JSON.stringify({ error: `Failed to fetch events: ${err}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const eventsData = await eventsRes.json()
      const events = eventsData.items || []

      // Upsert events into cassian_meetings
      let synced = 0
      for (const event of events) {
        // Skip all-day events (no dateTime)
        if (!event.start?.dateTime || !event.end?.dateTime) continue
        // Skip cancelled events
        if (event.status === 'cancelled') continue

        const meetingData = {
          user_id: userId,
          title: event.summary || '(No title)',
          description: event.description || null,
          location: event.location || null,
          start_time: event.start.dateTime,
          end_time: event.end.dateTime,
          attendees: (event.attendees || []).map((a: any) => a.email).filter(Boolean),
          meeting_type: 'general',
          priority: 'medium',
          status: 'scheduled',
          google_event_id: event.id,
          user_calendar_id: calendar.id,
        }

        // Check if exists
        const { data: existing } = await supabase
          .from('cassian_meetings')
          .select('id, is_ignored')
          .eq('google_event_id', event.id)
          .eq('user_calendar_id', calendar.id)
          .maybeSingle()

        if (existing) {
          // Update but preserve is_ignored
          await supabase.from('cassian_meetings')
            .update({
              title: meetingData.title,
              description: meetingData.description,
              location: meetingData.location,
              start_time: meetingData.start_time,
              end_time: meetingData.end_time,
              attendees: meetingData.attendees,
            })
            .eq('id', existing.id)
        } else {
          await supabase.from('cassian_meetings').insert(meetingData)
        }
        synced++
      }

      return new Response(JSON.stringify({ success: true, synced }), {
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
