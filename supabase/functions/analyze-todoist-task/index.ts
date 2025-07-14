import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface AnalysisRequest {
  taskId: string;
  title: string;
  description?: string;
}

interface AIResponse {
  category: 'easy' | 'high_priority' | 'normal';
  reasoning: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
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

    const { taskId, title, description = '' }: AnalysisRequest = await req.json()

    if (!taskId || !title) {
      return new Response(
        JSON.stringify({ error: 'taskId and title are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Analyzing task: ${title}`)

    // Create content hash for change detection
    const contentHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(title + '|' + description)
    )
    const hashString = Array.from(new Uint8Array(contentHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    // Check if we already have analysis for this exact content
    const { data: existingTask } = await supabase
      .from('todoist_tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('todoist_task_id', taskId)
      .eq('content_hash', hashString)
      .single()

    if (existingTask) {
      console.log('Task content unchanged, returning cached analysis')
      return new Response(
        JSON.stringify({ 
          success: true,
          cached: true,
          category: existingTask.ai_category,
          reasoning: existingTask.ai_reasoning
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call OpenAI for analysis
    const prompt = `Analyze this task and categorize it as "easy", "high_priority", or "normal".

Task: "${title}"
Description: "${description}"

Criteria:
- Easy: Can be completed in < 15 minutes, no complex thinking required, administrative/maintenance tasks
- High Priority: Has deadlines with consequences, blocks other important work, high opportunity cost if delayed, impacts relationships/finances/career
- Normal: Everything else that doesn't fit easy or high priority

Respond with JSON only:
{
  "category": "easy|high_priority|normal",
  "reasoning": "Brief explanation of why this category was chosen"
}`

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 150
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
    const aiContent = openaiData.choices[0]?.message?.content

    if (!aiContent) {
      return new Response(
        JSON.stringify({ error: 'No response from OpenAI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let aiResponse: AIResponse
    try {
      aiResponse = JSON.parse(aiContent)
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', aiContent)
      return new Response(
        JSON.stringify({ error: 'Invalid response format from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate AI response
    if (!['easy', 'high_priority', 'normal'].includes(aiResponse.category)) {
      console.error('Invalid category from AI:', aiResponse.category)
      aiResponse.category = 'normal' // Default fallback
    }

    // Store or update in database
    const { error: upsertError } = await supabase
      .from('todoist_tasks')
      .upsert({
        user_id: user.id,
        todoist_task_id: taskId,
        title,
        description,
        ai_category: aiResponse.category,
        ai_reasoning: aiResponse.reasoning,
        content_hash: hashString,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'user_id,todoist_task_id'
      })

    if (upsertError) {
      console.error('Database error:', upsertError)
      return new Response(
        JSON.stringify({ error: 'Failed to save analysis' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Task categorized as: ${aiResponse.category}`)

    return new Response(
      JSON.stringify({
        success: true,
        cached: false,
        category: aiResponse.category,
        reasoning: aiResponse.reasoning
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in analyze-todoist-task function:', error)
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