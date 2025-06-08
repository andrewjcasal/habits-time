/*
  # Contacts Table and Networking Actions Integration

  1. New Tables
    - `bolt_contacts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `name` (text)
      - `company` (text, nullable)
      - `role` (text, nullable)
      - `email` (text, nullable)
      - `phone` (text, nullable)
      - `notes` (text, nullable)
      - `last_contact_date` (timestamptz, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes
    - Update `actions` table to reference contacts
    - Add contact_id foreign key to actions
    - Migrate existing contact data from actions to contacts table

  3. Security
    - Enable RLS on contacts table
    - Add policies for users to manage their own contacts
*/

-- Create contacts table
CREATE TABLE IF NOT EXISTS public.bolt_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT,
  role TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  last_contact_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON public.bolt_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON public.bolt_contacts(name);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON public.bolt_contacts(company);

-- Enable RLS
ALTER TABLE public.bolt_contacts ENABLE ROW LEVEL SECURITY;

-- Create policies for contacts
CREATE POLICY "Users can view their own contacts"
  ON public.bolt_contacts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own contacts"
  ON public.bolt_contacts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts"
  ON public.bolt_contacts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts"
  ON public.bolt_contacts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER set_contacts_updated_at
  BEFORE UPDATE ON public.bolt_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add contact_id to actions table
ALTER TABLE public.actions 
  ADD COLUMN contact_id UUID REFERENCES public.bolt_contacts(id) ON DELETE SET NULL;

-- Create function to migrate existing action contacts to contacts table
CREATE OR REPLACE FUNCTION migrate_action_contacts()
RETURNS void AS $$
DECLARE
  action_record RECORD;
  found_contact_id UUID;
BEGIN
  -- Loop through all actions and create contacts
  FOR action_record IN 
    SELECT DISTINCT user_id, contact_name, company, role 
    FROM public.actions 
    WHERE contact_name IS NOT NULL
  LOOP
    -- Check if contact already exists
    SELECT id INTO found_contact_id 
    FROM public.bolt_contacts 
    WHERE user_id = action_record.user_id 
      AND name = action_record.contact_name 
      AND COALESCE(company, '') = COALESCE(action_record.company, '')
      AND COALESCE(role, '') = COALESCE(action_record.role, '');
    
    -- If contact doesn't exist, create it
    IF found_contact_id IS NULL THEN
      INSERT INTO public.bolt_contacts (user_id, name, company, role)
      VALUES (action_record.user_id, action_record.contact_name, action_record.company, action_record.role)
      RETURNING id INTO found_contact_id;
    END IF;
    
    -- Update actions to reference the contact
    UPDATE public.actions 
    SET contact_id = found_contact_id
    WHERE user_id = action_record.user_id 
      AND contact_name = action_record.contact_name 
      AND COALESCE(company, '') = COALESCE(action_record.company, '')
      AND COALESCE(role, '') = COALESCE(action_record.role, '');
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the migration
SELECT migrate_action_contacts();

-- Clean up
DROP FUNCTION migrate_action_contacts();

-- Create index for actions contact_id
CREATE INDEX IF NOT EXISTS idx_actions_contact_id ON public.actions(contact_id); 