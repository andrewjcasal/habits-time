import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
// import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const openAIApiKey = Deno.env.get('OPENAI_API_KEY')
// const supabaseUrl = Deno.env.get('SUPABASE_URL')!
// const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface GenerateSocialPostRequest {
  type: 'clarifying-questions' | 'generate-post' | 'adjust-tone' | 'improve-clarity' | 'suggest-hashtags'
  topic: string
  answers?: string[]
  content?: string
  knowledge?: string
  platform: 'twitter' | 'linkedin'
}

interface GenerateSocialPostResponse {
  questions?: string[]
  content?: string
  hashtags?: string[]
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { type, topic, answers, content, knowledge, platform }: GenerateSocialPostRequest = await req.json()

    if (!type || !topic || !platform) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: type, topic, platform' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!openAIApiKey) {
      console.warn('OpenAI API key not configured, cannot generate social post')
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('DEBUG - Generating social post:', { type, topic, platform })

    let systemPrompt = ''
    let userPrompt = ''

    const platformConstraints = platform === 'twitter' 
      ? 'Keep under 280 characters. Be concise and impactful.'
      : 'LinkedIn post format. Can be longer and more professional. Use line breaks for readability.'

    switch (type) {
      case 'clarifying-questions':
        systemPrompt = `You are a social media expert helping users create engaging posts. Generate exactly 3 specific, actionable clarifying questions that will help create better content.

Questions should:
- Help understand the user's unique angle or perspective
- Gather specific details, examples, or outcomes
- Identify the target audience or key message
- Be open-ended to encourage detailed responses
- Focus on what makes this topic personally meaningful

Return a JSON array of 3 question strings. No markdown, just valid JSON.`

        userPrompt = `Topic: ${topic}
Platform: ${platform}

Generate 3 clarifying questions to help create an engaging ${platform} post about this topic.`
        break

      case 'generate-post':
        if (!answers || answers.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Answers required for generate-post type' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }

        systemPrompt = `You are a social media expert creating engaging ${platform} posts. Create compelling content that:

${platformConstraints}

- Opens with a hook that grabs attention
- Tells a story or shares insights
- Includes specific details and examples
- Ends with engagement (question, call-to-action, or thought-provoking statement)
- Uses appropriate tone for ${platform}
- Is authentic and personal

${knowledge ? 'Use the provided knowledge base to inform your content but make it personal and engaging.' : ''}

Return only the post content as a string, no JSON wrapper or markdown.`

        userPrompt = `Topic: ${topic}

Answers to clarifying questions:
${answers.map((answer, i) => `${i + 1}. ${answer}`).join('\n')}

${knowledge ? `Knowledge base: ${knowledge}` : ''}

Create an engaging ${platform} post based on this information.`
        break

      case 'adjust-tone':
        if (!content) {
          return new Response(
            JSON.stringify({ error: 'Content required for adjust-tone type' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }

        systemPrompt = `You are a social media expert adjusting post tone. Take the existing content and modify it to be more engaging while keeping the core message.

${platformConstraints}

Adjustments to make:
- More conversational and relatable
- Add personality and authenticity
- Improve hook/opening
- Enhance emotional connection
- Better call-to-action or engagement
- Maintain factual accuracy

Return only the adjusted post content as a string, no JSON wrapper or markdown.`

        userPrompt = `Original post:
${content}

Platform: ${platform}

Adjust the tone to be more engaging and authentic for ${platform}.`
        break

      case 'improve-clarity':
        if (!content) {
          return new Response(
            JSON.stringify({ error: 'Content required for improve-clarity type' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }

        systemPrompt = `You are a social media expert improving post clarity. Take the existing content and make it clearer and more readable while maintaining the message.

${platformConstraints}

Improvements to make:
- Clearer structure and flow
- Better word choice and simpler language
- Remove unnecessary jargon
- Improve readability and scanning
- Ensure key points stand out
- Maintain original tone and personality

Return only the improved post content as a string, no JSON wrapper or markdown.`

        userPrompt = `Original post:
${content}

Platform: ${platform}

Improve the clarity and readability for ${platform}.`
        break

      case 'suggest-hashtags':
        systemPrompt = `You are a social media expert suggesting relevant hashtags. Generate hashtags that are:

- Relevant to the content and topic
- Mix of popular and niche tags
- Appropriate for ${platform}
- ${platform === 'twitter' ? '5-8 hashtags maximum' : '10-15 hashtags maximum'}
- Include both broad and specific tags
- Consider trending and evergreen options

Return a JSON array of hashtag strings (include the # symbol). No markdown, just valid JSON.`

        userPrompt = `${content ? `Post content: ${content}` : `Topic: ${topic}`}

Platform: ${platform}

Suggest relevant hashtags for this ${platform} post.`
        break

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid type parameter' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
    }

    // Call OpenAI API
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
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
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
    const responseContent = openAIData.choices[0]?.message?.content

    if (!responseContent) {
      console.log('DEBUG - No content generated')
      return new Response(JSON.stringify({ error: 'No content generated' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('DEBUG - OpenAI response:', responseContent)

    const result: GenerateSocialPostResponse = {}

    if (type === 'clarifying-questions' || type === 'suggest-hashtags') {
      // Parse JSON response for questions and hashtags
      try {
        const cleanContent = responseContent
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim()
        const parsedArray = JSON.parse(cleanContent)
        
        if (type === 'clarifying-questions') {
          result.questions = parsedArray
        } else {
          result.hashtags = parsedArray
        }
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', parseError)
        console.log('Raw response:', responseContent)
        return new Response(JSON.stringify({ error: 'Failed to parse OpenAI response' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else {
      // Direct content response for posts
      result.content = responseContent.trim()
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in generate-social-post function:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})