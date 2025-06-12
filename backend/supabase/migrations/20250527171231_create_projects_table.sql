-- Create the projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  encrypted_data TEXT NOT NULL,  -- Will store encrypted JSON data with name, color, etc.
  iv TEXT NOT NULL,              -- Initialization vector for decryption
  salt TEXT NOT NULL,            -- Salt used in encryption
  is_default BOOLEAN DEFAULT FALSE NOT NULL, -- Whether this is the default project
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add RLS (Row Level Security) policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policy to ensure users can only access their own projects
CREATE POLICY "Users can only access their own projects" 
  ON projects
  FOR ALL
  USING (auth.uid() = user_id);

-- Create index on user_id for faster lookups
CREATE INDEX projects_user_id_idx ON projects(user_id);

-- Create index on is_default for faster default project lookup
CREATE INDEX projects_user_id_default_idx ON projects(user_id, is_default) WHERE is_default = true;

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_projects_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function whenever a record is updated
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION update_projects_updated_at_column();

-- Ensure only one default project per user
CREATE UNIQUE INDEX projects_user_default_unique 
ON projects(user_id) 
WHERE is_default = true;