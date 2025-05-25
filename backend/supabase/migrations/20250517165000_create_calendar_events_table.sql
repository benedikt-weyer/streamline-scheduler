-- Create the calendar_events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  encrypted_data TEXT NOT NULL,  -- Will store encrypted JSON data with title, description, start_time, end_time
  iv TEXT NOT NULL,              -- Initialization vector for decryption
  salt TEXT NOT NULL,            -- Salt used in encryption
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add RLS (Row Level Security) policies
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Policy to ensure users can only access their own calendar events
CREATE POLICY "Users can only access their own calendar events" 
  ON calendar_events
  FOR ALL
  USING (auth.uid() = user_id);

-- Create index on user_id for faster lookups
CREATE INDEX calendar_events_user_id_idx ON calendar_events(user_id);

-- Function to automatically update the updated_at timestamp (if not already exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function whenever a record is updated
CREATE TRIGGER update_calendar_events_updated_at
BEFORE UPDATE ON calendar_events
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();