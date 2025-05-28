-- Add order column to projects table for drag and drop functionality
ALTER TABLE projects 
ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;

-- Create index on user_id and display_order for faster ordering
CREATE INDEX projects_user_display_order_idx ON projects(user_id, display_order);

-- Create index on user_id, parent_id and display_order for faster hierarchical ordering
CREATE INDEX projects_user_parent_display_order_idx ON projects(user_id, parent_id, display_order);

-- Update existing projects to have sequential order based on creation date
WITH ordered_projects AS (
  SELECT id, row_number() OVER (PARTITION BY user_id, parent_id ORDER BY created_at) - 1 AS new_order
  FROM projects
  WHERE display_order = 0
)
UPDATE projects 
SET display_order = ordered_projects.new_order
FROM ordered_projects
WHERE projects.id = ordered_projects.id;
