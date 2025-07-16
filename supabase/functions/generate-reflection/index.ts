import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const openAIApiKey = Deno.env.get('OPENAI_API_KEY')
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const redditClientId = Deno.env.get('REDDIT_CLIENT_ID')
const redditClientSecret = Deno.env.get('REDDIT_CLIENT_SECRET')

interface ReflectionRequest {
  userId: string;
  date?: string;
}

interface RedditPost {
  title: string;
  url: string;
  subreddit: string;
  upvotes: number;
  comments: number;
}

async function getRedditAccessToken(): Promise<string | null> {
  if (!redditClientId || !redditClientSecret) {
    console.log('DEBUG - Reddit OAuth credentials not configured')
    return null
  }

  try {
    console.log('DEBUG - Getting Reddit OAuth token...')
    
    const credentials = btoa(`${redditClientId}:${redditClientSecret}`)
    
    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'HabitsApp/1.0 by /u/habits_user'
      },
      body: 'grant_type=client_credentials'
    })

    if (!response.ok) {
      console.log('DEBUG - Reddit OAuth failed:', response.status, response.statusText)
      return null
    }

    const data = await response.json()
    console.log('DEBUG - Reddit OAuth successful')
    return data.access_token
  } catch (error) {
    console.error('DEBUG - Reddit OAuth error:', error)
    return null
  }
}

async function fetchRedditPostsWithOpenAI(recentHabits: any[], recentNotes: any[], currentHabits: any[], openAIApiKey: string): Promise<RedditPost[]> {
  try {
    console.log('DEBUG - Step 1: Getting search terms from OpenAI...')
    
    // Step 1: Get search terms from OpenAI
    const searchTermsResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Generate 2-3 specific search terms to find relevant Reddit posts for someone working on habits. Return only the search terms, one per line, no quotes or explanations.'
          },
          {
            role: 'user',
            content: `Based on these habits and notes, what search terms would find relevant posts?

Recent habits: ${recentHabits?.map(h => h.habits?.name).join(', ') || 'Morning routines, building consistency'}
Recent notes: ${recentNotes?.slice(0, 1).map(n => n.content.substring(0, 200)).join('. ') || 'Working on building better habits'}

Focus on finding posts from people who are 1-2 steps ahead in their habit journey.`
          }
        ],
        temperature: 0.5,
        max_tokens: 100
      })
    })

    const searchData = await searchTermsResponse.json()
    const searchTerms = searchData.choices[0]?.message?.content?.split('\n').filter(Boolean) || ['morning routine habits', 'habit building consistency']
    console.log('DEBUG - Search terms:', searchTerms)

    // Step 2: Get Reddit OAuth token and search all of Reddit
    const accessToken = await getRedditAccessToken()
    const allPosts: any[] = []

    if (!accessToken) {
      console.log('DEBUG - No Reddit access token, skipping Reddit search')
      return []
    }

    try {
      for (const term of searchTerms.slice(0, 3)) {
        try {
          // Clean the search term - remove quotes and extra whitespace
          const cleanTerm = term.replace(/['"]/g, '').trim()
          const searchUrl = `https://oauth.reddit.com/search.json?q=${encodeURIComponent(cleanTerm)}`
          console.log(`DEBUG - General Reddit search: ${searchUrl}`)
          
          const response = await fetch(searchUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'User-Agent': 'HabitsApp/1.0 by /u/habits_user'
            }
          })

          console.log(`DEBUG - General search response status: ${response.status}`)
          if (response.ok) {
            const data = await response.json()
            console.log(`DEBUG - Raw Reddit response:`, JSON.stringify(data, null, 2))
            const posts = data.data?.children || []
            console.log(`DEBUG - Found ${posts.length} posts across Reddit for "${cleanTerm}"`)
            
            for (const postData of posts) {
              const post = postData.data
              console.log(`DEBUG - Post: ${post.title} in r/${post.subreddit} (${post.ups} ups, selftext: ${post.selftext ? 'yes' : 'no'})`)
              
              // Filter for quality posts - let OpenAI handle relevance filtering
              if (post.ups > 10 && !post.stickied && !post.over_18) { // Basic quality filter
                allPosts.push({
                  title: post.title,
                  url: `https://reddit.com${post.permalink}`,
                  subreddit: post.subreddit,
                  upvotes: post.ups,
                  comments: post.num_comments,
                  selftext: post.selftext ? post.selftext.substring(0, 500) : '' // For relevance checking
                })
                console.log(`DEBUG - Added post: ${post.title}`)
              }
            }
          } else {
            console.log(`DEBUG - General search failed: ${response.status} ${response.statusText}`)
          }
          console.log(`DEBUG - Completed processing search term: "${term}", allPosts.length now: ${allPosts.length}`)
        } catch (error) {
          console.error(`DEBUG - Error in general Reddit search for term "${term}":`, error)
        }
      }
    } catch (error) {
      console.error(`DEBUG - Error in search loop:`, error)
    }

    console.log(`DEBUG - Found ${allPosts.length} total posts`)

    if (allPosts.length === 0) {
      console.log('DEBUG - No Reddit posts found (likely due to API restrictions)')
      return []
    }

    const numMatches = 5

    // Build context about the user's current habits
    const currentHabitsContext = currentHabits?.length
      ? currentHabits.map(habit => {
          const benefits = habit.benefits?.length ? ` - Benefits: ${habit.benefits.join(', ')}` : ''
          const consequences = habit.consequences?.length ? ` - Consequences when skipped: ${habit.consequences.join(', ')}` : ''
          return `${habit.name}${benefits}${consequences}`
        }).join(' | ')
      : 'No current habits available.'

    const recentNotesContext = recentNotes?.length 
      ? recentNotes.map(note => note.content).join(' | ')
      : 'No recent notes.'

    const prompt = `I'm working on these specific habits and challenges:

MY CURRENT HABITS:
${currentHabitsContext}

MY RECENT CHALLENGES (from habit notes):
${recentNotesContext}

Look at each Reddit post title below and find ${numMatches} that would be most helpful for someone with these specific habits and challenges. 

Prioritize posts about:

- The user's current habits: Specific effectiveness, outcomes, transformation stories, consequences for not doing those habits (i.e. If a user's current habit is: Morning Routine, then effectiveness of morning routine, consequences for stopping doing it like feeling sluggish throughout the day)
- If user's current habits includes a shutdown routine, focus on sleep habits too
- Staying grounded, focused, and emotionally regulated throughout the day
- If the user's current habits pertain to meals, then meal timing and energy management strategies
- Extrapolate from user's recent notes, brainstorming or successful transitions in the following: if they have animals, then posts about animal care routines; if they are isolated, then friendship, networking, or community routines; habits that improve work/life balance, especially if user's notes mention working too hard or throughout the day, and burning out; if they have been overreliant on their partners or community, share stories on personal habit formation specifically as a benefit to relieve stress from their network
- Focus on posts on the reddit thread author's personal experience, instead of a compilation of tips.
- Don't get too into specific tools. If a person wants to build finance routines, but doesn't state what they use, don't assume any one tool, i.e. "Excel"
- Don't assume too specific combined topics, i.e. "unprocessed eating on a budget" if the user has difficulties with maintaining finance habits and food habits; but recommend if the user is comfortable with finance habits, budgeting habits, and food habits in general
- No manifestation or medical/health posts, except for AuDHD, ADHD, executive dysfunction, and symptoms like fatigue, energy crash, brain fog.
- Min 2 posts if the user shares any frustrations and missteps through the current routine, provide resources to get back on track.
- Limit 1 post that's ADHD/AuDHD related.
- Limit 1 post focusing on relationships, and ONLY if it's about building habits within relationships or partners supporting each other's habit development. 
- Limit 1 post focused on weight loss, 2 if the user in their notes mention weight loss routines.

EXCLUDE these types of posts:
- General relationship advice or petty conflicts
- Family drama, pregnancy announcements, or parenting disputes
- Posts about what other people should do vs. personal habit experiences
- Workplace conflicts or interpersonal drama
- Posts focused on convincing others or dealing with difficult people

Posts should pertain to the specific current habits previously listed; to challenges, frustrations or wins (in budding areas) in the notes.
Don't include "why habits, habits formation, and routines in general are good" posts. Have it pertain primarily around the user's current habits.

${allPosts.map((post, i) => 
  `${i+1}. Title: "${post.title}"
     URL: ${post.url}
     Subreddit: r/${post.subreddit}
     Upvotes: ${post.upvotes}
     Comments: ${post.comments}`
).join('\n\n')}

Return JSON array of the ${numMatches} best matches that would provide valuable insights for my specific habit challenges:
[{"title": "exact title from above", "url": "exact url from above", "subreddit": "exact subreddit", "upvotes": number, "comments": number, "reasoning": "relevant because it addresses [specific connection to my habits, timing struggles, or challenges]"}]`;

    console.log('DEBUG - About to send prompt to OpenAI:', prompt.substring(0, 500) + '...')
    console.log('DEBUG - Full prompt length:', prompt.length)
    // Step 3: Have OpenAI filter for the most relevant posts
    const relevanceResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'o1-mini',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    })

    const relevanceData = await relevanceResponse.json()
    console.log('relevance', relevanceData)
    console.log('currentHabitsContext', currentHabitsContext)
    console.log('recentNotesContext', recentNotesContext)
    const content = relevanceData.choices[0]?.message?.content

    if (!content) {
      console.log('DEBUG - No relevance filtering response')
      return [];
    }

    console.log('DEBUG - OpenAI relevance response:', content)

    // Parse the filtered results - handle markdown formatting from o1-mini
    try {
      // Strip markdown code blocks and explanatory text
      let cleanContent = content.trim()
      
      // Remove markdown code blocks
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```.*$/s, '')
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```.*$/s, '')
      }
      
      // Clean up any JavaScript template literal syntax that might interfere with JSON parsing
      cleanContent = cleanContent.replace(/`/g, '"').replace(/\$\{[^}]*\}/g, '')
      
      console.log('DEBUG - Cleaned content for parsing:', cleanContent.substring(0, 1000))
      
      // Extract just the JSON array - use a more robust approach
      // Find the first [ and then count brackets to find the matching ]
      const startIndex = cleanContent.indexOf('[');
      if (startIndex !== -1) {
        let bracketCount = 0;
        let endIndex = -1;
        
        for (let i = startIndex; i < cleanContent.length; i++) {
          if (cleanContent[i] === '[') bracketCount++;
          if (cleanContent[i] === ']') bracketCount--;
          if (bracketCount === 0) {
            endIndex = i;
            break;
          }
        }
        
        if (endIndex !== -1) {
          cleanContent = cleanContent.substring(startIndex, endIndex + 1);
          console.log('DEBUG - Extracted JSON array:', cleanContent.substring(0, 500) + '...')
        } else {
          console.log('DEBUG - Could not find matching closing bracket')
        }
      } else {
        console.log('DEBUG - No JSON array found in content')
      }
      
      console.log('DEBUG - Final content to parse:', JSON.stringify(cleanContent))
      const filteredPosts = JSON.parse(cleanContent)
      if (Array.isArray(filteredPosts)) {
        console.log('DEBUG - OpenAI selected', filteredPosts.length, 'relevant posts')
        
        // Log the reasoning for each selection
        filteredPosts.forEach((post, i) => {
          console.log(`DEBUG - Selection ${i + 1}: "${post.title}" - Reasoning: ${post.reasoning || 'No reasoning provided'}`)
        })
        
        return filteredPosts.slice(0, numMatches)
      }
    } catch (parseError) {
      console.log('DEBUG - Failed to parse relevance response:', parseError)
      console.log('DEBUG - Raw content to parse:', JSON.stringify(content))
      // Fallback to first 3 posts
      return []
    }

    return []

  } catch (error) {
    console.error('Error in Reddit search pipeline:', error)
    return []
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)
  
  // Handle Reddit OAuth callback if code parameter is present
  if (url.searchParams.get('code')) {
    const code = url.searchParams.get('code')
    const error = url.searchParams.get('error')
    
    if (error) {
      return new Response(
        JSON.stringify({ error: `Reddit OAuth error: ${error}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (code) {
      // Exchange code for access token
      const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${redditClientId}:${redditClientSecret}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'HabitsApp/1.0'
        },
        body: `grant_type=authorization_code&code=${code}`
      })
      
      const tokenData = await tokenResponse.json()
      
      if (tokenData.access_token) {
        return new Response(
          JSON.stringify({ access_token: tokenData.access_token }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }
    
    return new Response(
      JSON.stringify({ error: 'Failed to get Reddit access token' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Handle reflection generation (existing logic)
  try {
    const { userId, date = new Date().toISOString().split('T')[0] }: ReflectionRequest = await req.json()
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create Supabase client with service role key for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey)


    // Get recent habit notes (last 3 days)
    const threeDaysAgo = new Date(date)
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    
    const { data: recentNotes } = await supabase
      .from('habits_notes')
      .select('created_at, content')
      .eq('user_id', userId)
      .gte('created_at', threeDaysAgo.toISOString().split('T')[0])
      .order('created_at', { ascending: false })
      .limit(3)

    // Get recent completed habits (last 3 days)
    const { data: recentHabits } = await supabase
      .from('habits_daily_logs')
      .select(`
        log_date,
        is_completed,
        notes,
        habits!inner(name)
      `)
      .eq('user_id', userId)
      .eq('is_completed', true)
      .gte('log_date', threeDaysAgo.toISOString().split('T')[0])
      .order('log_date', { ascending: false })
      .limit(10)

    // Get current visible habits for context
    const { data: currentHabits } = await supabase
      .from('habits')
      .select('name, benefits, consequences, duration, default_start_time, current_start_time')
      .eq('user_id', userId)
      .eq('is_visible', true)
      .order('default_start_time')

    // Prepare context for OpenAI
    const notesContext = recentNotes?.length 
      ? recentNotes.map(note => `${note.created_at}: ${note.content}`).join('\n\n')
      : 'No recent habit notes available.'

    const habitsContext = recentHabits?.length
      ? recentHabits.map(habit => 
          `${habit.log_date}: Completed "${habit.habits.name}"${habit.notes ? ` - ${habit.notes}` : ''}`
        ).join('\n')
      : 'No recent completed habits available.'

    // Debug logging to see what data we're working with
    console.log('DEBUG - Notes context:', notesContext)
    console.log('DEBUG - Habits context:', habitsContext)
    console.log('DEBUG - Recent notes count:', recentNotes?.length || 0)
    console.log('DEBUG - Recent habits count:', recentHabits?.length || 0)

    // Fetch relevant Reddit posts using OpenAI
    console.log('DEBUG - Starting Reddit post fetch...')
    const redditPosts = await fetchRedditPostsWithOpenAI(recentHabits, recentNotes, currentHabits, openAIApiKey)
    console.log('DEBUG - Reddit posts found:', redditPosts.length)
    console.log('DEBUG - Reddit posts:', JSON.stringify(redditPosts, null, 2))

    // Generate reflection using OpenAI
    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a habit coach writing a concise daily reflection focusing on recent progress and momentum. Write exactly 2 paragraphs.

FOCUS ON:
- Recent habit completions and notes since the last note.
- Specific progress since their last reflection 
- If you see notes from a week ago vs recent notes, highlight improvements: "A week ago you mentioned X, and now I see Y - that's real progress"
- Concrete next steps to build on current momentum
- Brief celebration of wins, then challenge them to go further
- Acknowledge missteps and frustrations the user might be having; notice any breaks or lateness in routine, make compromises, and get back on track.

TONE: Supportive coach focused on forward momentum, not feelings processing.

STRUCTURE:
Paragraph 1: Recent habit achievements and note observations (what they've accomplished, specific progress)
Paragraph 2: Next steps and momentum building (what to focus on next, gentle challenge)

Keep it concise: 100-150 words total, exactly 2 paragraphs.`
          },
          {
            role: 'user',
            content: `Write a 2-paragraph reflection based on recent habit progress:

RECENT HABIT NOTES (last 3 days):
${notesContext}

RECENT COMPLETED HABITS (last 3 days):
${habitsContext}

Focus on what they've accomplished recently, any progress from previous notes, and what to build on next. Reference specific things they mentioned. Keep it concise and forward-focused.`
          }
        ],
        temperature: 0.7,
        max_tokens: 250
      })
    })

    if (!openAIResponse.ok) {
      const error = await openAIResponse.text()
      console.error('OpenAI API error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to generate reflection' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const openAIData = await openAIResponse.json()
    const reflection = openAIData.choices[0]?.message?.content

    if (!reflection) {
      return new Response(
        JSON.stringify({ error: 'No reflection generated' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Save reflection to database (upsert to update existing or create new)
    // Try with reddit_links first, fallback without if column doesn't exist
    let saveError;
    try {
      const { error } = await supabase
        .from('daily_reflections')
        .upsert({
          user_id: userId,
          reflection_date: date,
          content: reflection,
          reddit_links: JSON.stringify(redditPosts)
        }, {
          onConflict: 'user_id,reflection_date'
        })
      saveError = error;
    } catch (error) {
      console.log('Failed to save with reddit_links, trying without:', error)
      // Fallback: save without reddit_links column
      const { error: fallbackError } = await supabase
        .from('daily_reflections')
        .upsert({
          user_id: userId,
          reflection_date: date,
          content: reflection
        }, {
          onConflict: 'user_id,reflection_date'
        })
      saveError = fallbackError;
    }

    if (saveError) {
      console.error('Error saving reflection:', saveError)
      console.error('Save error details:', {
        code: saveError.code,
        message: saveError.message,
        details: saveError.details,
        hint: saveError.hint
      })
      // Still return the reflection even if saving fails
    } else {
      console.log('Reflection saved successfully for user:', userId, 'date:', date)
    }

    return new Response(
      JSON.stringify({ 
        reflection,
        reddit_links: redditPosts,
        cached: false,
        generated_at: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in generate-reflection function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})