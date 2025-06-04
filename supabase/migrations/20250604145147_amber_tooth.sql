-- Insert mock feed data
INSERT INTO public.bolt_feed (user_id, type, title, description, url, read, created_at) VALUES
  -- Connection notifications
  (auth.uid(), 'connection', 'Sarah Chen viewed your profile', 'Engineering Manager at Google', 'https://linkedin.com/in/sarah-chen', false, now() - interval '1 hour'),
  (auth.uid(), 'connection', 'Alex Rodriguez sent you a connection request', 'Senior Software Engineer at Meta', 'https://linkedin.com/in/alex-rodriguez', false, now() - interval '3 hours'),
  (auth.uid(), 'connection', 'Michael Kim accepted your connection request', 'Tech Lead at Amazon', 'https://linkedin.com/in/michael-kim', false, now() - interval '5 hours'),
  
  -- Job view notifications
  (auth.uid(), 'job_view', 'Your application was viewed', 'Google - Senior Frontend Engineer', null, false, now() - interval '2 hours'),
  (auth.uid(), 'job_view', 'Your application status updated', 'Microsoft - Staff Engineer position moved to "Interviewing"', null, true, now() - interval '1 day'),
  (auth.uid(), 'job_view', 'New similar job posted', 'Senior React Developer at Stripe matches your profile', null, true, now() - interval '2 days'),
  
  -- Messages
  (auth.uid(), 'message', 'New message from recruiter', 'Hi! I saw your application and would love to chat about the Senior Frontend role at Netflix', null, false, now() - interval '30 minutes'),
  (auth.uid(), 'message', 'Interview scheduled', 'Technical interview for Staff Engineer position at Microsoft scheduled for next Tuesday', null, true, now() - interval '4 hours'),
  (auth.uid(), 'message', 'Follow-up from hiring manager', 'Thanks for your time today! I enjoyed our conversation about system design', null, true, now() - interval '6 hours');