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

async function fetchRedditPostsWithOpenAI(recentHabits: any[], recentNotes: any[], openAIApiKey: string): Promise<RedditPost[]> {
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
      } catch (error) {
        console.error(`Error in general Reddit search:`, error)
      }
    }

    console.log(`DEBUG - Found ${allPosts.length} total posts`)

    if (allPosts.length === 0) {
      console.log('DEBUG - No Reddit posts found (likely due to API restrictions)')
      return []
    }

    // Step 3: Have OpenAI filter for the most relevant posts
    const relevanceResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `Select 3 Reddit posts specifically about building habits, routines, and consistency. Prioritize posts whose TITLES explicitly mention these keywords: ${recentHabits?.map(h => h.habits?.name).join(', ') || 'Morning routines, building consistency'}.

STRONGLY PREFER posts with titles containing:
- "habit" / "habits" 
- "routine" / "routines"
- "morning" / "evening" / "shutdown"
- "building" / "build"
- "tips" / "advice" 
- "consistency" / "consistent"

AVOID posts that are primarily:
- Medical/health condition success stories (unless specifically about building health habits)
- Relationship advice or personal drama
- Manifestation/law of attraction content
- General life stories without habit focus

Choose posts that would actually help someone improve their daily routines and habit consistency, not just inspirational stories.

Return exactly 3 posts as a JSON array:
[
  {
    "title": "exact title from the post",
    "url": "exact url from the post", 
    "subreddit": "exact subreddit",
    "upvotes": exact_number,
    "comments": exact_number
  }
]

Return ONLY the JSON array with no markdown formatting.`
          },
          {
            role: 'user',
            content: `User context:
Recent habits: ${recentHabits?.map(h => h.habits?.name).join(', ') || 'Morning routines'}
Recent notes: ${recentNotes?.slice(0, 1).map(n => n.content.substring(0, 200)).join('. ') || 'Building habits'}

Posts to evaluate:
${allPosts.slice(0, 10).map((post, i) => 
  `${i+1}. Title: "${post.title}"
  URL: ${post.url}
  Subreddit: r/${post.subreddit}
  Upvotes: ${post.upvotes}
  Comments: ${post.comments}
  Preview: ${post.selftext.substring(0, 150)}...
  
`).join('')}

Select the 3 most relevant posts for this person's habit journey.`
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    })

    const relevanceData = await relevanceResponse.json()
    const content = relevanceData.choices[0]?.message?.content

    if (!content) {
      console.log('DEBUG - No relevance filtering response')
      return allPosts.slice(0, 3).map(post => ({
        title: post.title,
        url: post.url,
        subreddit: post.subreddit,
        upvotes: post.upvotes,
        comments: post.comments
      }))
    }

    console.log('DEBUG - OpenAI relevance response:', content)

    // Parse the filtered results
    try {
      const filteredPosts = JSON.parse(content)
      if (Array.isArray(filteredPosts)) {
        console.log('DEBUG - OpenAI selected', filteredPosts.length, 'relevant posts')
        return filteredPosts.slice(0, 3)
      }
    } catch (parseError) {
      console.log('DEBUG - Failed to parse relevance response:', parseError)
      // Fallback to first 3 posts
      return allPosts.slice(0, 3).map(post => ({
        title: post.title,
        url: post.url,
        subreddit: post.subreddit,
        upvotes: post.upvotes,
        comments: post.comments
      }))
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
        body: `grant_type=authorization_code&code=${code}&redirect_uri=${redditRedirectUri}`
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

    // Check if reflection already exists for today
    const { data: existingReflection } = await supabase
      .from('daily_reflections')
      .select('*')
      .eq('user_id', userId)
      .eq('reflection_date', date)
      .single()

    if (existingReflection) {
      // Parse reddit_links from JSON if it exists
      let redditLinks = []
      if (existingReflection.reddit_links) {
        try {
          redditLinks = typeof existingReflection.reddit_links === 'string' 
            ? JSON.parse(existingReflection.reddit_links) 
            : existingReflection.reddit_links
        } catch (e) {
          console.log('Error parsing reddit_links:', e)
          redditLinks = []
        }
      }
      
      return new Response(
        JSON.stringify({ 
          reflection: existingReflection.content,
          reddit_links: redditLinks,
          cached: true,
          generated_at: existingReflection.generated_at
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

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
    const redditPosts = await fetchRedditPostsWithOpenAI(recentHabits, recentNotes, openAIApiKey)
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
            content: `You are a habit coach writing a personal reflection based on someone's actual tracking data and notes. You've read their notes carefully and want to move them forward with momentum, not therapize them.

COACH APPROACH:
- Reference specific things they said in their notes
- Share relevant anecdotes of success (people who got better sleep, became more disciplined, etc.)
- Provide concrete next steps and resources
- Focus on building momentum rather than processing feelings
- If they're struggling, acknowledge it briefly then pivot to forward action
- If they show effort (like restarting routines), celebrate and push for more
- Share stories of others who overcame similar challenges
- Be encouraging but challenge them to stretch beyond comfort zone
- Less "How are you feeling?" and more "Here's what works..."
- Include: "I see you're building confidence with these habits - as you get stronger, I'm happy to show you some new steps to go."

TONE: Supportive coach who believes in their potential and wants to see them grow, not a therapist exploring feelings. Focus on momentum, resources, and gentle challenges to do more.

150-250 words, 2-3 paragraphs.`
          },
          {
            role: 'user',
            content: `Write a personal reflection based on this specific habit data:

RECENT HABIT NOTES:
${notesContext}

RECENT COMPLETED HABITS:
${habitsContext}

Reference specific things they mentioned in their notes. Share relevant success stories or anecdotes (people who overcame similar challenges, got better sleep, became more disciplined). Provide concrete next steps and momentum. If they're restarting habits or showing effort, celebrate briefly then challenge them to go further. End with something like "I see you're building confidence with these habits - as you get stronger, I'm happy to show you some new steps to go." Focus on growth and forward action, not feelings.`
          }
        ],
        temperature: 0.7,
        max_tokens: 400
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

    // Save reflection to database
    // Try with reddit_links first, fallback without if column doesn't exist
    let saveError;
    try {
      const { error } = await supabase
        .from('daily_reflections')
        .insert({
          user_id: userId,
          reflection_date: date,
          content: reflection,
          reddit_links: JSON.stringify(redditPosts)
        })
      saveError = error;
    } catch (error) {
      console.log('Failed to save with reddit_links, trying without:', error)
      // Fallback: save without reddit_links column
      const { error: fallbackError } = await supabase
        .from('daily_reflections')
        .insert({
          user_id: userId,
          reflection_date: date,
          content: reflection
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