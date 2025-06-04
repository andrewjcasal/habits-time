/*
  # Job Application Tracking System

  1. New Tables
    - `bolt_companies`
      - `id` (uuid, primary key)
      - `name` (text)
      - `website` (text, nullable)
      - `description` (text, nullable)
      - `industry` (text, nullable)
      - `size` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `bolt_applications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `company_id` (uuid, foreign key)
      - `position` (text)
      - `status` (text)
      - `applied_date` (timestamptz)
      - `url` (text, nullable)
      - `notes` (text, nullable)
      - `next_step` (text, nullable)
      - `next_step_date` (timestamptz, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to:
      - Read and write their own applications
      - Read all companies
      - Create new companies
*/

-- Create companies table
CREATE TABLE IF NOT EXISTS public.bolt_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  website TEXT,
  description TEXT,
  industry TEXT,
  size TEXT CHECK (size IN ('1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create applications table
CREATE TABLE IF NOT EXISTS public.bolt_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.bolt_companies(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('applied', 'interviewing', 'rejected', 'offered', 'accepted', 'withdrawn')),
  applied_date TIMESTAMPTZ NOT NULL,
  url TEXT,
  notes TEXT,
  next_step TEXT,
  next_step_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.bolt_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_company_id ON public.bolt_applications(company_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.bolt_applications(status);
CREATE INDEX IF NOT EXISTS idx_companies_name ON public.bolt_companies(name);

-- Enable RLS
ALTER TABLE public.bolt_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bolt_applications ENABLE ROW LEVEL SECURITY;

-- Create policies for companies
CREATE POLICY "Allow public read access to companies"
  ON public.bolt_companies FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated users to create companies"
  ON public.bolt_companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create policies for applications
CREATE POLICY "Users can view their own applications"
  ON public.bolt_applications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own applications"
  ON public.bolt_applications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own applications"
  ON public.bolt_applications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own applications"
  ON public.bolt_applications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_companies_updated_at
  BEFORE UPDATE ON public.bolt_companies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_applications_updated_at
  BEFORE UPDATE ON public.bolt_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Insert some sample companies
INSERT INTO public.bolt_companies (name, website, industry, size) VALUES
  ('Google', 'https://google.com', 'Technology', '5000+'),
  ('Microsoft', 'https://microsoft.com', 'Technology', '5000+'),
  ('Amazon', 'https://amazon.com', 'Technology', '5000+'),
  ('Meta', 'https://meta.com', 'Technology', '5000+'),
  ('Apple', 'https://apple.com', 'Technology', '5000+'),
  ('Netflix', 'https://netflix.com', 'Technology', '5000+'),
  ('Stripe', 'https://stripe.com', 'Technology', '1001-5000'),
  ('Airbnb', 'https://airbnb.com', 'Technology', '1001-5000'),
  ('Uber', 'https://uber.com', 'Technology', '5000+'),
  ('Twitter', 'https://twitter.com', 'Technology', '1001-5000');