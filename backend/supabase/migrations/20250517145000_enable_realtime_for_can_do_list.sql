-- Enable real-time for can_do_list table
BEGIN;
  -- Add can_do_list table to the supabase_realtime publication
  ALTER PUBLICATION supabase_realtime ADD TABLE can_do_list;
COMMIT;