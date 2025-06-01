-- Create tables with proper constraints
CREATE TABLE IF NOT EXISTS bolt_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bolt_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  category_id UUID REFERENCES bolt_categories(id),
  url TEXT,
  description TEXT,
  completed BOOLEAN DEFAULT false,
  last_attempted TIMESTAMPTZ,
  next_review TIMESTAMPTZ,
  level INTEGER DEFAULT 0,
  notes TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid()
);

-- Enable RLS
ALTER TABLE bolt_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE bolt_problems ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow public read access on bolt_categories" ON bolt_categories
  FOR SELECT TO public USING (true);

CREATE POLICY "Allow authenticated users to read their problems" ON bolt_problems
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to update their problems" ON bolt_problems
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Insert categories
INSERT INTO bolt_categories (name, description) VALUES
  ('Arrays & Hashing', 'Problems involving array manipulation and hash tables'),
  ('Two Pointers', 'Problems solved using two pointer technique'),
  ('Sliding Window', 'Problems involving sliding window algorithms'),
  ('Stack', 'Problems involving stack data structures'),
  ('Binary Search', 'Problems solved using binary search'),
  ('Linked List', 'Problems involving linked list data structures'),
  ('Trees', 'Problems involving tree data structures'),
  ('Tries', 'Problems involving trie data structures'),
  ('Heap / Priority Queue', 'Problems involving heap data structures'),
  ('Backtracking', 'Problems solved using backtracking'),
  ('Graphs', 'Problems involving graph algorithms'),
  ('Advanced Graphs', 'Advanced problems involving graph theory'),
  ('Dynamic Programming', 'Problems solved using dynamic programming'),
  ('1D Dynamic Programming', 'One-dimensional dynamic programming problems'),
  ('2D Dynamic Programming', 'Two-dimensional dynamic programming problems'),
  ('Greedy', 'Problems solved using greedy algorithms'),
  ('Intervals', 'Problems involving interval manipulation'),
  ('Math & Geometry', 'Mathematical and geometric problems'),
  ('Bit Manipulation', 'Problems involving bit operations');

-- Insert initial set of problems
WITH category_ids AS (
  SELECT id, name FROM bolt_categories
)
INSERT INTO bolt_problems (title, difficulty, category_id, url, description, tags)
VALUES
  ('Two Sum', 'Easy', (SELECT id FROM category_ids WHERE name = 'Arrays & Hashing'), 'https://leetcode.com/problems/two-sum/', 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.', ARRAY['Array', 'Hash Table']),
  ('Valid Parentheses', 'Easy', (SELECT id FROM category_ids WHERE name = 'Stack'), 'https://leetcode.com/problems/valid-parentheses/', 'Given a string s containing just the characters ''('', '')'', ''{'', ''}'', ''['' and '']'', determine if the input string is valid.', ARRAY['String', 'Stack']),
  ('Merge Two Sorted Lists', 'Easy', (SELECT id FROM category_ids WHERE name = 'Linked List'), 'https://leetcode.com/problems/merge-two-sorted-lists/', 'Merge two sorted linked lists and return it as a sorted list.', ARRAY['Linked List', 'Recursion']),
  ('Best Time to Buy and Sell Stock', 'Easy', (SELECT id FROM category_ids WHERE name = 'Arrays & Hashing'), 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/', 'You are given an array prices where prices[i] is the price of a given stock on the ith day.', ARRAY['Array', 'Dynamic Programming']),
  ('Valid Palindrome', 'Easy', (SELECT id FROM category_ids WHERE name = 'Two Pointers'), 'https://leetcode.com/problems/valid-palindrome/', 'A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward.', ARRAY['String', 'Two Pointers']),
  ('Invert Binary Tree', 'Easy', (SELECT id FROM category_ids WHERE name = 'Trees'), 'https://leetcode.com/problems/invert-binary-tree/', 'Given the root of a binary tree, invert the tree, and return its root.', ARRAY['Tree', 'DFS', 'BFS']),
  ('Valid Anagram', 'Easy', (SELECT id FROM category_ids WHERE name = 'Arrays & Hashing'), 'https://leetcode.com/problems/valid-anagram/', 'Given two strings s and t, return true if t is an anagram of s, and false otherwise.', ARRAY['Hash Table', 'String', 'Sorting']),
  ('Binary Search', 'Easy', (SELECT id FROM category_ids WHERE name = 'Binary Search'), 'https://leetcode.com/problems/binary-search/', 'Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums.', ARRAY['Array', 'Binary Search']),
  ('Flood Fill', 'Easy', (SELECT id FROM category_ids WHERE name = 'Graphs'), 'https://leetcode.com/problems/flood-fill/', 'An image is represented by an m x n integer grid image where image[i][j] represents the pixel value of the image.', ARRAY['Array', 'DFS', 'BFS', 'Matrix']),
  ('Maximum Depth of Binary Tree', 'Easy', (SELECT id FROM category_ids WHERE name = 'Trees'), 'https://leetcode.com/problems/maximum-depth-of-binary-tree/', 'Given the root of a binary tree, return its maximum depth.', ARRAY['Tree', 'DFS', 'BFS']),
  ('Contains Duplicate', 'Easy', (SELECT id FROM category_ids WHERE name = 'Arrays & Hashing'), 'https://leetcode.com/problems/contains-duplicate/', 'Given an integer array nums, return true if any value appears at least twice in the array.', ARRAY['Array', 'Hash Table', 'Sorting']),
  ('Lowest Common Ancestor of a BST', 'Easy', (SELECT id FROM category_ids WHERE name = 'Trees'), 'https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-search-tree/', 'Given a binary search tree (BST), find the lowest common ancestor (LCA) node of two given nodes in the BST.', ARRAY['Tree', 'DFS', 'Binary Search Tree']),
  ('Balanced Binary Tree', 'Easy', (SELECT id FROM category_ids WHERE name = 'Trees'), 'https://leetcode.com/problems/balanced-binary-tree/', 'Given a binary tree, determine if it is height-balanced.', ARRAY['Tree', 'DFS']),
  ('Linked List Cycle', 'Easy', (SELECT id FROM category_ids WHERE name = 'Linked List'), 'https://leetcode.com/problems/linked-list-cycle/', 'Given head, the head of a linked list, determine if the linked list has a cycle in it.', ARRAY['Hash Table', 'Linked List', 'Two Pointers']),
  ('Implement Queue using Stacks', 'Easy', (SELECT id FROM category_ids WHERE name = 'Stack'), 'https://leetcode.com/problems/implement-queue-using-stacks/', 'Implement a first in first out (FIFO) queue using only two stacks.', ARRAY['Stack', 'Design', 'Queue']);

-- Generate remaining problems with varied difficulties and categories
WITH RECURSIVE numbers AS (
  SELECT 16 as n
  UNION ALL
  SELECT n + 1 FROM numbers WHERE n < 150
),
random_categories AS (
  SELECT n, (SELECT id FROM bolt_categories ORDER BY random() LIMIT 1) as category_id
  FROM numbers
)
INSERT INTO bolt_problems (title, difficulty, category_id, url, description, tags)
SELECT 
  'Problem ' || n,
  CASE (floor(random() * 3))::integer
    WHEN 0 THEN 'Easy'
    WHEN 1 THEN 'Medium'
    ELSE 'Hard'
  END,
  category_id,
  'https://leetcode.com/problems/problem-' || n || '/',
  'This is problem number ' || n || ' in the Neetcode 150 series.',
  ARRAY['Algorithm', 'Data Structure']
FROM random_categories;