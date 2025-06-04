-- Create function to get or create sample user ID
CREATE OR REPLACE FUNCTION get_sample_user_id()
RETURNS UUID AS $$
DECLARE
  sample_id UUID;
BEGIN
  -- Try to get first user from auth.users
  SELECT id INTO sample_id FROM auth.users LIMIT 1;
  
  -- If no users exist, use a constant UUID
  IF sample_id IS NULL THEN
    sample_id := '00000000-0000-0000-0000-000000000000'::UUID;
  END IF;
  
  RETURN sample_id;
END;
$$ LANGUAGE plpgsql;

-- Insert mock feed data
INSERT INTO public.bolt_feed (user_id, type, title, description, url, read, created_at) VALUES
  -- Connection notifications
  ((SELECT get_sample_user_id()), 'connection', 'Sarah Chen viewed your profile', 'Engineering Manager at Google', 'https://linkedin.com/in/sarah-chen', false, now() - interval '1 hour'),
  ((SELECT get_sample_user_id()), 'connection', 'Alex Rodriguez sent you a connection request', 'Senior Software Engineer at Meta', 'https://linkedin.com/in/alex-rodriguez', false, now() - interval '3 hours'),
  ((SELECT get_sample_user_id()), 'connection', 'Michael Kim accepted your connection request', 'Tech Lead at Amazon', 'https://linkedin.com/in/michael-kim', false, now() - interval '5 hours'),
  
  -- Job view notifications
  ((SELECT get_sample_user_id()), 'job_view', 'Your application was viewed', 'Google - Senior Frontend Engineer', null, false, now() - interval '2 hours'),
  ((SELECT get_sample_user_id()), 'job_view', 'Your application status updated', 'Microsoft - Staff Engineer position moved to "Interviewing"', null, true, now() - interval '1 day'),
  ((SELECT get_sample_user_id()), 'job_view', 'New similar job posted', 'Senior React Developer at Stripe matches your profile', null, true, now() - interval '2 days'),
  
  -- Messages
  ((SELECT get_sample_user_id()), 'message', 'New message from recruiter', 'Hi! I saw your application and would love to chat about the Senior Frontend role at Netflix', null, false, now() - interval '30 minutes'),
  ((SELECT get_sample_user_id()), 'message', 'Interview scheduled', 'Technical interview for Staff Engineer position at Microsoft scheduled for next Tuesday', null, true, now() - interval '4 hours'),
  ((SELECT get_sample_user_id()), 'message', 'Follow-up from hiring manager', 'Thanks for your time today! I enjoyed our conversation about system design', null, true, now() - interval '6 hours');

-- Clean up
DROP FUNCTION get_sample_user_id();