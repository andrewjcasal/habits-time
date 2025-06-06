import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js';

serve(async (req) => {
  try {
    const { activity_name, start_time } = await req.json();
    
    // Get user ID from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user from JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!activity_name) {
      return new Response(JSON.stringify({ error: 'Missing activity_name field' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // First, find or create the activity type
    let { data: activityType, error: activityError } = await supabase
      .from('activity_types')
      .select('id')
      .eq('name', activity_name)
      .eq('user_id', user.id)
      .single();

    if (activityError && activityError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected if activity doesn't exist
      return new Response(JSON.stringify({ error: 'Failed to find activity type' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // If activity type doesn't exist, create it
    if (!activityType) {
      const { data: newActivityType, error: createError } = await supabase
        .from('activity_types')
        .insert([{
          name: activity_name,
          user_id: user.id
        }])
        .select()
        .single();

      if (createError) {
        return new Response(JSON.stringify({ error: 'Failed to create activity type' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      activityType = newActivityType;
    }

    // Now insert the time log
    const { data: timeLog, error: insertError } = await supabase
      .from('time_logs')
      .insert([{
        activity_type_id: activityType.id,
        user_id: user.id,
        start_time: start_time || new Date().toISOString()
      }])
      .select(`
        id,
        start_time,
        end_time,
        activity_types (
          id,
          name
        )
      `)
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: 'Failed to create time log', details: insertError }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      data: timeLog 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}); 