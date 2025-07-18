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

IMPORTANT: Avoid extracting wins that are similar or duplicate to these recent wins:
${recentWinsText}

Only extract wins that are genuinely NEW and different from what's already been recorded. If a win is too similar to an existing one, skip it.

Keep titles under 60 characters and celebratory in tone. Only return wins that are clearly positive achievements.

Return ONLY valid JSON array format, no markdown or extra text:`,
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

    // Helper function to check semantic similarity
    const isSimilarWin = (newWin: ExtractedWin, existingWins: any[]): boolean => {
      const newText = `${newWin.title} ${newWin.description || ''}`.toLowerCase()

      for (const existing of existingWins) {
        const existingText = `${existing.title} ${existing.description || ''}`.toLowerCase()

        // Check for key phrase overlap
        const newWords = newText.split(/\s+/).filter(w => w.length > 3) // Filter out short words
        const existingWords = existingText.split(/\s+/).filter(w => w.length > 3)

        // Calculate word overlap percentage
        const overlap = newWords.filter(word => existingWords.includes(word))
        const overlapPercentage = overlap.length / Math.max(newWords.length, existingWords.length)

        // Check for similar titles (more strict)
        const titleSimilarity = calculateSimilarity(
          newWin.title.toLowerCase(),
          existing.title.toLowerCase()
        )

        // Consider it similar if:
        // 1. Title similarity > 60% AND word overlap > 30%, OR
        // 2. Word overlap > 50% (high content overlap)
        if ((titleSimilarity > 0.6 && overlapPercentage > 0.3) || overlapPercentage > 0.5) {
          console.log(
            `DEBUG - Similar win detected. New: "${newWin.title}" vs Existing: "${existing.title}" (title sim: ${Math.round(titleSimilarity * 100)}%, word overlap: ${Math.round(overlapPercentage * 100)}%)`
          )
          return true
        }
      }
      return false
    }

    // Simple string similarity function (Levenshtein-based)
    const calculateSimilarity = (str1: string, str2: string): number => {
      const longer = str1.length > str2.length ? str1 : str2
      const shorter = str1.length > str2.length ? str2 : str1
      const editDistance = levenshteinDistance(longer, shorter)
      return (longer.length - editDistance) / longer.length
    }

    const levenshteinDistance = (str1: string, str2: string): number => {
      const matrix = []
      for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i]
      }
      for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j
      }
      for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
          if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1]
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            )
          }
        }
      }
      return matrix[str2.length][str1.length]
    }

    // Filter out similar wins before inserting
    const filteredWins = extractedWins.filter(win => {
      if (isSimilarWin(win, recentWins || [])) {
        console.log('DEBUG - Semantic duplicate detected, skipping:', win.title)
        return false
      }
      return true
    })

    console.log(
      `DEBUG - After similarity filtering: ${filteredWins.length}/${extractedWins.length} wins remaining`
    )

    // Insert wins into database (duplicate prevention handled by unique constraint)
    let successCount = 0
    let duplicateCount = 0
    let similaritySkippedCount = extractedWins.length - filteredWins.length

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
        similaritySkipped: similaritySkippedCount,
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
