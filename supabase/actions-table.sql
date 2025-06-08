-- Actions table for tracking networking and outreach activities
CREATE TABLE actions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_name VARCHAR(255) NOT NULL,
  company VARCHAR(255) NOT NULL,
  role VARCHAR(255) NOT NULL,
  action_taken TEXT NOT NULL,
  follow_up_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own actions
CREATE POLICY "Users can view own actions" ON actions
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own actions
CREATE POLICY "Users can insert own actions" ON actions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own actions
CREATE POLICY "Users can update own actions" ON actions
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own actions
CREATE POLICY "Users can delete own actions" ON actions
  FOR DELETE USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_actions_updated_at
  BEFORE UPDATE ON actions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data based on the image
INSERT INTO actions (user_id, contact_name, company, role, action_taken, follow_up_date) VALUES
  (auth.uid(), 'Hiring Manager', 'Acme Health', 'EM, Frontend', 'Followed, Commented, Connect Req', '2024-06-10'),
  (auth.uid(), 'Jane Doe', 'Acme Health', '2nd-degree PM', 'Asked intro via CT', '2024-06-11'),
  (auth.uid(), 'Anna Miller', 'Connector', 'Recruiter', 'Engaged w/ her feed', NULL);

-- Create index for better performance
CREATE INDEX idx_actions_user_id ON actions(user_id);
CREATE INDEX idx_actions_company ON actions(company);
CREATE INDEX idx_actions_follow_up_date ON actions(follow_up_date); 