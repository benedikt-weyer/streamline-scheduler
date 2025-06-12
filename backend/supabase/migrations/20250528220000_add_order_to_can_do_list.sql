-- Add display_order column to can_do_list table for drag and drop functionality
ALTER TABLE can_do_list 
ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;

-- Create index on user_id and display_order for faster ordering
CREATE INDEX can_do_list_user_display_order_idx ON can_do_list(user_id, display_order);

-- Create index on user_id, project_id and display_order for faster project-specific ordering
CREATE INDEX can_do_list_user_project_display_order_idx ON can_do_list(user_id, project_id, display_order);

-- Update existing tasks to have sequential order based on creation date (newest first, so reverse order)
WITH ordered_tasks AS (
  SELECT id, row_number() OVER (PARTITION BY user_id, project_id ORDER BY created_at DESC) - 1 AS new_order
  FROM can_do_list
  WHERE display_order = 0
)
UPDATE can_do_list 
SET display_order = ordered_tasks.new_order
FROM ordered_tasks
WHERE can_do_list.id = ordered_tasks.id;
