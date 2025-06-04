/*
  # Create feed table and move mock data

  1. New Tables
    - `bolt_feed`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `type` (text) - connection, job_view, message
      - `title` (text)
      - `description` (text, nullable)
      - `url` (text, nullable)
      - `read` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for users to:
      - View their own feed items
      - Update read status of their own feed items
*/

-- Create feed table
CREATE TABLE IF NOT EXISTS public.bolt_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('connection', 'job_view', 'message')),
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_feed_user_id ON public.bolt_feed(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_type ON public.bolt_feed(type);
CREATE INDEX IF NOT EXISTS idx_feed_read ON public.bolt_feed(read);

-- Enable RLS
ALTER TABLE public.bolt_feed ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own feed items"
  ON public.bolt_feed FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update read status of their own feed items"
  ON public.bolt_feed FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER set_feed_updated_at
  BEFORE UPDATE ON public.bolt_feed
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();