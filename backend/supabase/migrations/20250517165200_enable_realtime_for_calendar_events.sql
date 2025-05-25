-- Enable real-time for calendar_events table
BEGIN;
  -- Add calendar_events table to the supabase_realtime publication
  ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events;
COMMIT;