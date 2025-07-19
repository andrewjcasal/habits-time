import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const openAIApiKey = Deno.env.get('OPENAI_API_KEY')
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface ExtractWinsRequest {
  noteId: string
  noteContent: string
  userId: string
}

interface ExtractedWin {
  title: string
  description?: string
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { noteId, noteContent, userId }: ExtractWinsRequest = await req.json()

    if (!noteId || !noteContent || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: noteId, noteContent, userId' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!openAIApiKey) {
      console.warn('OpenAI API key not configured, skipping win extraction')
      return new Response(JSON.stringify({ message: 'OpenAI API key not configured' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!noteContent.trim() || noteContent.trim().length < 20) {
      return new Response(JSON.stringify({ message: 'Note content too short for extraction' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('DEBUG - Extracting wins from note:', noteId, 'Content length:', noteContent.length)

    // Create Supabase client with service role key for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get recent wins to avoid duplicates
    const { data: recentWins } = await supabase
      .from('wins')
      .select('title, description')
      .eq('user_id', userId)
      .order('extracted_at', { ascending: false })
      .limit(10)

    const recentWinsText =
      recentWins && recentWins.length > 0
        ? recentWins.map(w => `- ${w.title}${w.description ? `: ${w.description}` : ''}`).join('\n')
        : 'No recent wins found'

    console.log('DEBUG - Recent wins for context:', recentWinsText)

    // Call OpenAI to extract wins
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Analyze this note and extract any wins, achievements, accomplishments, or positive moments. 
Return a JSON array of wins, each with a "title" (short, celebratory) and optional "description".

Focus on:
- Completed goals or milestones
- Personal achievements 
- Positive life events
- Habit successes
- Work/career wins
- Health improvements
- Learning accomplishments
- Breakthrough moments
- Overcoming challenges

Ignore:
- Future plans or intentions
- Negative events
- Routine daily activities
- Mundane updates
- Complaints or problems

CRITICAL: These wins have already been recorded recently:
${recentWinsText}

DO NOT extract any wins that are:
- The same event or achievement as above
- Minor variations of the above wins
- Similar accomplishments in the same area
- Repetitive daily habit completions already recorded

Be extremely strict about avoiding duplicates. When in doubt, do NOT extract the win. Only extract wins that are completely new, unique accomplishments that haven't been captured before.

Each win must be:
- A distinct, one-time achievement
- Clearly different from recent wins
- Worth celebrating independently
- Under 60 characters for the title

Return ONLY valid JSON array format, no markdown or extra text. If no new wins are found, return an empty array []:`,
          },
          {
            role: 'user',
            content: `Note content: ${noteContent}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    })

    if (!openAIResponse.ok) {
      console.error('OpenAI API error:', openAIResponse.status, openAIResponse.statusText)
      return new Response(JSON.stringify({ error: `OpenAI API error: ${openAIResponse.status}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const openAIData = await openAIResponse.json()
    const content = openAIData.choices[0]?.message?.content

    if (!content) {
      console.log('DEBUG - No wins extracted from note')
      return new Response(JSON.stringify({ message: 'No wins found in note', winsExtracted: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('DEBUG - OpenAI response:', content)

    // Parse the extracted wins
    let extractedWins: ExtractedWin[]
    try {
      // Clean the content in case OpenAI returns markdown code blocks
      const cleanContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      extractedWins = JSON.parse(cleanContent)
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError)
      console.log('Raw response:', content)
      return new Response(JSON.stringify({ error: 'Failed to parse OpenAI response' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!Array.isArray(extractedWins) || extractedWins.length === 0) {
      console.log('DEBUG - No valid wins found in note')
      return new Response(JSON.stringify({ message: 'No valid wins found', winsExtracted: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('DEBUG - Extracted wins:', extractedWins)

    // Simple duplicate check - rely more on OpenAI to avoid duplicates
    const filteredWins = extractedWins.filter(win => {
      // Basic exact title match check
      const isDuplicate = recentWins?.some(existing => 
        existing.title.toLowerCase().trim() === win.title.toLowerCase().trim()
      )
      
      if (isDuplicate) {
        console.log('DEBUG - Exact duplicate detected, skipping:', win.title)
        return false
      }
      return true
    })

    console.log(
      `DEBUG - After duplicate filtering: ${filteredWins.length}/${extractedWins.length} wins remaining`
    )

    // Insert wins into database (duplicate prevention handled by unique constraint)
    let successCount = 0
    let duplicateCount = 0
    let duplicateSkippedCount = extractedWins.length - filteredWins.length

    for (const win of filteredWins) {
      if (!win.title || win.title.trim().length === 0) {
        continue // Skip invalid wins
      }

      try {
        const { error } = await supabase.from('wins').insert({
          user_id: userId,
          title: win.title.trim(),
          description: win.description?.trim() || null,
          source_type: 'note',
          source_id: noteId,
          extracted_at: new Date().toISOString(),
        })

        if (error) {
          const errorMessage = error.message || error.toString() || 'Unknown error'
          if (errorMessage.includes('unique_user_win') || errorMessage.includes('duplicate key')) {
            console.log('DEBUG - Duplicate win skipped:', win.title)
            duplicateCount++
          } else {
            console.error('Error inserting win:', error)
          }
        } else {
          console.log('DEBUG - Successfully extracted win:', win.title)
          successCount++
        }
      } catch (insertError) {
        console.error('Error inserting win:', insertError)
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Win extraction completed',
        winsExtracted: successCount,
        duplicatesSkipped: duplicateCount,
        duplicateSkippedCount: duplicateSkippedCount,
        totalProcessed: extractedWins.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in extract-wins function:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
