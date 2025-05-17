-- Enable real-time for calendars table
BEGIN;
  -- Add calendars table to the supabase_realtime publication
  ALTER PUBLICATION supabase_realtime ADD TABLE calendars;
COMMIT;
