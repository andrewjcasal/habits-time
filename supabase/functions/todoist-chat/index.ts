import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
const todoistApiKey = Deno.env.get('TODOIST_API_KEY')
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface ChatRequest {
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  messages: Array<{role: 'user' | 'assistant', content: string}>;
  userMessage: string;
  action?: 'chat' | 'update_task';
  newTitle?: string;
  contextToAdd?: string;
  newDescription?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (!openaiApiKey || !todoistApiKey) {
      return new Response(
        JSON.stringify({ error: 'API keys not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user from JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { 
      taskId, 
      taskTitle, 
      taskDescription = '', 
      messages, 
      userMessage, 
      action = 'chat',
      newTitle,
      contextToAdd,
      newDescription
    }: ChatRequest = await req.json()

    if (!taskId || !taskTitle) {
      return new Response(
        JSON.stringify({ error: 'taskId and taskTitle are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle task update action
    if (action === 'update_task') {
      if (!newTitle && !contextToAdd && !newDescription) {
        return new Response(
          JSON.stringify({ error: 'newTitle, contextToAdd, or newDescription required for update action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Prepare update payload
      const updatePayload: any = {}
      
      if (newTitle) {
        updatePayload.content = newTitle
      }
      
      if (newDescription) {
        // Use the provided new description directly
        updatePayload.description = newDescription
      } else if (contextToAdd) {
        // Add context to description, preserving existing content
        const updatedDescription = taskDescription 
          ? `${contextToAdd}\n\n---\n\n${taskDescription}`
          : contextToAdd
        updatePayload.description = updatedDescription
      }

      // Update task in Todoist
      const todoistResponse = await fetch(`https://api.todoist.com/rest/v2/tasks/${taskId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${todoistApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatePayload)
      })

      if (!todoistResponse.ok) {
        console.error('Todoist API error:', todoistResponse.status, todoistResponse.statusText)
        return new Response(
          JSON.stringify({ error: `Failed to update task in Todoist: ${todoistResponse.status}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const updatedTask = await todoistResponse.json()

      return new Response(
        JSON.stringify({ 
          success: true,
          action: 'update_task',
          updatedTask
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle chat action
    if (!userMessage) {
      return new Response(
        JSON.stringify({ error: 'userMessage is required for chat action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build conversation for OpenAI
    const systemPrompt = `You are a productivity assistant helping a user work through a specific Todoist task. 

Task: "${taskTitle}"
Description: "${taskDescription}"

Your role:
1. Help the user understand, break down, or get unstuck on this task
2. Ask clarifying questions to better understand what's blocking them
3. Suggest practical next steps or approaches
4. If the user asks, you can suggest improvements to the task title or description
5. Keep responses concise and actionable

You have two special capabilities:
- You can suggest a clearer task title by saying "SUGGEST_TITLE: [new title]"
- You can suggest adding context to the description by saying "SUGGEST_CONTEXT: [3 sentences of helpful context]"

Only use these suggestions when they would genuinely help clarify or improve the task.`

    const conversationMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
      { role: 'user', content: userMessage }
    ]

    // Call OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: conversationMessages,
        temperature: 0.7,
        max_tokens: 300
      })
    })

    if (!openaiResponse.ok) {
      console.error('OpenAI API error:', openaiResponse.status, openaiResponse.statusText)
      return new Response(
        JSON.stringify({ error: `OpenAI API error: ${openaiResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const openaiData = await openaiResponse.json()
    const assistantMessage = openaiData.choices[0]?.message?.content

    if (!assistantMessage) {
      return new Response(
        JSON.stringify({ error: 'No response from OpenAI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse for special suggestions
    let cleanedMessage = assistantMessage
    let suggestedTitle = null
    let suggestedContext = null

    const titleMatch = assistantMessage.match(/SUGGEST_TITLE:\s*(.+?)(?:\n|$)/i)
    if (titleMatch) {
      suggestedTitle = titleMatch[1].trim()
      cleanedMessage = cleanedMessage.replace(/SUGGEST_TITLE:\s*.+?(?:\n|$)/gi, '').trim()
    }

    const contextMatch = assistantMessage.match(/SUGGEST_CONTEXT:\s*(.+?)(?:\n\n|$)/is)
    if (contextMatch) {
      suggestedContext = contextMatch[1].trim()
      cleanedMessage = cleanedMessage.replace(/SUGGEST_CONTEXT:\s*.+?(?:\n\n|$)/gis, '').trim()
    }

    return new Response(
      JSON.stringify({
        success: true,
        action: 'chat',
        message: cleanedMessage,
        suggestedTitle,
        suggestedContext
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in todoist-chat function:', error)
    const errorMessage = error.message || error.toString() || 'Unknown error'
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: errorMessage
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})