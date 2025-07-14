import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const todoistApiKey = Deno.env.get('TODOIST_API_KEY')
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface TodoistTask {
  id: string;
  content: string;
  description: string;
  due?: {
    date: string;
    datetime?: string;
    string: string;
    timezone?: string;
  };
  priority: number; // 1-4 in Todoist (4 = highest)
  is_completed: boolean;
  created_at: string;
  project_id: string;
  section_id?: string;
  parent_id?: string;
  order: number;
  labels: string[];
  url: string;
}

interface TodoistProject {
  id: string;
  name: string;
  comment_count: number;
  order: number;
  color: string;
  is_shared: boolean;
  is_favorite: boolean;
  is_inbox_project: boolean;
  is_team_inbox: boolean;
  view_style: string;
  url: string;
  parent_id?: string;
}

interface ProcessedTask {
  id: string;
  title: string;
  description: string;
  dueDate?: string;
  isCompleted: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
  projectName?: string;
  url: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (!todoistApiKey) {
      return new Response(
        JSON.stringify({ error: 'Todoist API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('DEBUG - Fetching tasks from Todoist API...')

    // Fetch tasks from Todoist API
    const tasksResponse = await fetch('https://api.todoist.com/rest/v2/tasks', {
      headers: {
        'Authorization': `Bearer ${todoistApiKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!tasksResponse.ok) {
      console.error('Todoist API error:', tasksResponse.status, tasksResponse.statusText)
      return new Response(
        JSON.stringify({ error: `Todoist API error: ${tasksResponse.status}` }),
        { 
          status: tasksResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const tasks: TodoistTask[] = await tasksResponse.json()
    console.log('DEBUG - Fetched', tasks.length, 'tasks from Todoist')

    // Fetch projects to get project names
    const projectsResponse = await fetch('https://api.todoist.com/rest/v2/projects', {
      headers: {
        'Authorization': `Bearer ${todoistApiKey}`,
        'Content-Type': 'application/json'
      }
    })

    let projects: TodoistProject[] = []
    if (projectsResponse.ok) {
      projects = await projectsResponse.json()
      console.log('DEBUG - Fetched', projects.length, 'projects from Todoist')
    }

    // Create project lookup map
    const projectLookup = projects.reduce((acc, project) => {
      acc[project.id] = project.name
      return acc
    }, {} as Record<string, string>)

    // Convert Todoist priority (1-4) to our priority system
    const convertPriority = (todoistPriority: number): 'low' | 'medium' | 'high' | 'urgent' => {
      switch (todoistPriority) {
        case 4: return 'urgent'  // p1 in Todoist
        case 3: return 'high'    // p2 in Todoist
        case 2: return 'medium'  // p3 in Todoist
        case 1:
        default: return 'low'    // p4 in Todoist (default)
      }
    }

    // Process tasks
    const processedTasks: ProcessedTask[] = tasks.map(task => ({
      id: task.id,
      title: task.content,
      description: task.description || '',
      dueDate: task.due?.date || undefined,
      isCompleted: task.is_completed,
      priority: convertPriority(task.priority),
      createdAt: task.created_at,
      projectName: projectLookup[task.project_id] || 'Unknown Project',
      url: task.url
    }))

    console.log('DEBUG - Processed tasks:', processedTasks.length)

    // Filter tasks for today, overdue, and inbox
    const today = new Date().toISOString().split('T')[0]
    
    const todayTasks = processedTasks.filter(task => 
      task.dueDate === today
    )
    
    const overdueTasks = processedTasks.filter(task => 
      !task.isCompleted && 
      task.dueDate && 
      task.dueDate < today
    )

    // Find the inbox project (is_inbox_project = true)
    const inboxProject = projects.find(project => project.is_inbox_project);
    const inboxProjectId = inboxProject?.id;
    
    // Inbox tasks are tasks from the actual Inbox project only
    const inboxTasks = processedTasks.filter(task => {
      // Find the original task to get project_id
      const originalTask = tasks.find(t => t.id === task.id);
      return originalTask?.project_id === inboxProjectId;
    })

    console.log('DEBUG - Today tasks:', todayTasks.length, 'Overdue tasks:', overdueTasks.length, 'Inbox tasks:', inboxTasks.length)

    // Get AI categories for all tasks
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get user from JWT
    const authHeader = req.headers.get('Authorization')
    let user = null
    if (authHeader) {
      const { data: { user: authUser } } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      )
      user = authUser
    }

    let tasksWithAI = processedTasks
    if (user) {
      // Fetch existing AI analyses with content hashes
      const { data: aiAnalyses } = await supabase
        .from('todoist_tasks')
        .select('todoist_task_id, ai_category, ai_reasoning, content_hash')
        .eq('user_id', user.id)

      const aiLookup = aiAnalyses?.reduce((acc, analysis) => {
        acc[analysis.todoist_task_id] = {
          category: analysis.ai_category,
          reasoning: analysis.ai_reasoning,
          contentHash: analysis.content_hash
        }
        return acc
      }, {} as Record<string, { category: string, reasoning: string, contentHash: string }>) || {}

      // Check for content changes and add AI data to tasks
      const changedTaskIds: string[] = []
      
      tasksWithAI = processedTasks.map(task => {
        const existingAnalysis = aiLookup[task.id]
        let aiCategory = existingAnalysis?.category || null
        let aiReasoning = existingAnalysis?.reasoning || null
        
        if (existingAnalysis) {
          // Calculate current content hash using crypto.subtle.digest
          const currentContent = task.title + '|' + (task.description || '')
          
          // Create a simple hash comparison
          // Note: We should compare with actual stored content, not hash
          // For now, let's mark any task with existing analysis but no stored hash as needing re-analysis
          if (!existingAnalysis.contentHash) {
            console.log(`Task ${task.id} has analysis but no content hash - marking for re-analysis`)
            changedTaskIds.push(task.id)
            aiCategory = null
            aiReasoning = null
          }
        }
        
        return {
          ...task,
          aiCategory,
          aiReasoning,
          needsReanalysis: changedTaskIds.includes(task.id)
        }
      })

      // Update filtered arrays with AI data
      const updateTasksWithAI = (taskList: any[]) => taskList.map(task => ({
        ...task,
        aiCategory: aiLookup[task.id]?.category || null,
        aiReasoning: aiLookup[task.id]?.reasoning || null
      }))

      const todayTasksWithAI = updateTasksWithAI(todayTasks)
      const overdueTasksWithAI = updateTasksWithAI(overdueTasks)
      const inboxTasksWithAI = updateTasksWithAI(inboxTasks)

      return new Response(
        JSON.stringify({ 
          success: true,
          tasks: {
            today: todayTasksWithAI,
            overdue: overdueTasksWithAI,
            inbox: inboxTasksWithAI,
            all: tasksWithAI
          },
          meta: {
            totalTasks: tasks.length,
            todayCount: todayTasks.length,
            overdueCount: overdueTasks.length,
            inboxCount: inboxTasks.length,
            fetchedAt: new Date().toISOString()
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        tasks: {
          today: todayTasks,
          overdue: overdueTasks,
          inbox: inboxTasks,
          all: processedTasks
        },
        meta: {
          totalTasks: tasks.length,
          todayCount: todayTasks.length,
          overdueCount: overdueTasks.length,
          inboxCount: inboxTasks.length,
          fetchedAt: new Date().toISOString()
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in todoist-sync function:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})