/*
  # Create tables for spaced repetition system

  1. New Tables
    - `bolt_categories`
      - `id` (serial, primary key)
      - `name` (text)
      - `description` (text, nullable)
      - `created_at` (timestamptz)
    
    - `bolt_problems`
      - `id` (serial, primary key)
      - `title` (text)
      - `difficulty` (text)
      - `category_id` (integer, foreign key)
      - `url` (text, nullable)
      - `description` (text, nullable)
      - `completed` (boolean)
      - `last_attempted` (timestamptz, nullable)
      - `next_review` (timestamptz, nullable)
      - `level` (integer)
      - `notes` (text, nullable)
      - `tags` (text array)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to:
      - Read all categories
      - Read and update their own problems
*/

-- Create the categories table
CREATE TABLE IF NOT EXISTS bolt_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create the problems table
CREATE TABLE IF NOT EXISTS bolt_problems (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  category_id INTEGER REFERENCES bolt_categories(id),
  url TEXT,
  description TEXT,
  completed BOOLEAN DEFAULT false,
  last_attempted TIMESTAMPTZ,
  next_review TIMESTAMPTZ,
  level INTEGER DEFAULT 0,
  notes TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID NOT NULL DEFAULT auth.uid()
);

-- Enable Row Level Security
ALTER TABLE bolt_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE bolt_problems ENABLE ROW LEVEL SECURITY;

-- Create security policies
CREATE POLICY "Allow users to read all categories"
  ON bolt_categories
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can read their own problems"
  ON bolt_problems
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own problems"
  ON bolt_problems
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own problems"
  ON bolt_problems
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_problems_next_review ON bolt_problems(next_review);
CREATE INDEX IF NOT EXISTS idx_problems_user_id ON bolt_problems(user_id);