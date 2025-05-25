-- Create the calendars table
CREATE TABLE IF NOT EXISTS calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  encrypted_data TEXT NOT NULL,  -- Will store encrypted JSON data with name and color
  iv TEXT NOT NULL,              -- Initialization vector for decryption
  salt TEXT NOT NULL,            -- Salt used in encryption
  is_default BOOLEAN DEFAULT FALSE NOT NULL, -- Whether this is the default calendar
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add RLS (Row Level Security) policies
ALTER TABLE calendars ENABLE ROW LEVEL SECURITY;

-- Policy to ensure users can only access their own calendars
CREATE POLICY "Users can only access their own calendars" 
  ON calendars
  FOR ALL
  USING (auth.uid() = user_id);

-- Create index on user_id for faster lookups
CREATE INDEX calendars_user_id_idx ON calendars(user_id);

-- Trigger to call the update_updated_at_column function whenever a record is updated
CREATE TRIGGER update_calendars_updated_at
BEFORE UPDATE ON calendars
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
