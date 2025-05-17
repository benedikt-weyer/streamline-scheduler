-- Create the can_do_list table
CREATE TABLE IF NOT EXISTS can_do_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  encrypted_data TEXT NOT NULL,  -- Will store encrypted JSON data
  iv TEXT NOT NULL,              -- Initialization vector for decryption
  salt TEXT NOT NULL,            -- Salt used in encryption
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add RLS (Row Level Security) policies
ALTER TABLE can_do_list ENABLE ROW LEVEL SECURITY;

-- Policy to ensure users can only access their own items
CREATE POLICY "Users can only access their own can-do items" 
  ON can_do_list
  FOR ALL
  USING (auth.uid() = user_id);

-- Create index on user_id for faster lookups
CREATE INDEX can_do_list_user_id_idx ON can_do_list(user_id);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function whenever a record is updated
CREATE TRIGGER update_can_do_list_updated_at
BEFORE UPDATE ON can_do_list
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();