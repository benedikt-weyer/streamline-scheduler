-- Enable real-time for projects table
BEGIN;
  -- Add projects table to the supabase_realtime publication
  ALTER PUBLICATION supabase_realtime ADD TABLE projects;
COMMIT;