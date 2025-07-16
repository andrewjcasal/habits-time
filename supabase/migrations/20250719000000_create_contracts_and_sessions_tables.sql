/*
  # Contracts and Sessions Tables

  1. New Tables
    - `contracts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `name` (text)
      - `description` (text, nullable)
      - `status` (text) - 'active', 'completed', 'cancelled'
      - `start_date` (date, nullable)
      - `end_date` (date, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      
    - `sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `project_id` (uuid, foreign key)
      - `scheduled_date` (date)
      - `scheduled_hours` (decimal)
      - `actual_start_time` (timestamptz, nullable)
      - `actual_end_time` (timestamptz, nullable)
      - `actual_hours` (decimal, nullable)
      - `status` (text) - 'scheduled', 'in_progress', 'completed', 'cancelled'
      - `notes` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      
    - `contract_sessions`
      - `id` (uuid, primary key)
      - `contract_id` (uuid, foreign key)
      - `session_id` (uuid, foreign key)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for users to manage their own contracts and sessions
*/

-- Create contracts table
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'cancelled')) DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create sessions table
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  scheduled_hours DECIMAL(4,2) NOT NULL CHECK (scheduled_hours > 0),
  actual_start_time TIMESTAMPTZ,
  actual_end_time TIMESTAMPTZ,
  actual_hours DECIMAL(4,2) CHECK (actual_hours > 0),
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')) DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create contract_sessions table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.contract_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contract_id, session_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contracts_user_id ON public.contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_start_date ON public.contracts(start_date);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON public.contracts(end_date);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON public.sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_scheduled_date ON public.sessions(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions(status);

CREATE INDEX IF NOT EXISTS idx_contract_sessions_contract_id ON public.contract_sessions(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_sessions_session_id ON public.contract_sessions(session_id);

-- Enable RLS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for contracts
CREATE POLICY "Users can view their own contracts"
  ON public.contracts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own contracts"
  ON public.contracts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contracts"
  ON public.contracts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contracts"
  ON public.contracts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for sessions
CREATE POLICY "Users can view their own sessions"
  ON public.sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sessions"
  ON public.sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON public.sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
  ON public.sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for contract_sessions
CREATE POLICY "Users can view their own contract_sessions"
  ON public.contract_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c 
      WHERE c.id = contract_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own contract_sessions"
  ON public.contract_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contracts c 
      WHERE c.id = contract_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own contract_sessions"
  ON public.contract_sessions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c 
      WHERE c.id = contract_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own contract_sessions"
  ON public.contract_sessions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c 
      WHERE c.id = contract_id AND c.user_id = auth.uid()
    )
  );

-- Create updated_at triggers
CREATE TRIGGER set_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add constraint to ensure actual_end_time is after actual_start_time
ALTER TABLE public.sessions 
ADD CONSTRAINT check_actual_times 
CHECK (actual_end_time IS NULL OR actual_start_time IS NULL OR actual_end_time > actual_start_time);