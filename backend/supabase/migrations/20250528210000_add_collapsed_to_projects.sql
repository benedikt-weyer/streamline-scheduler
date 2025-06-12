-- Add is_collapsed column to projects table for persistent collapse state
ALTER TABLE projects 
ADD COLUMN is_collapsed BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index on user_id and is_collapsed for faster filtering
CREATE INDEX projects_user_collapsed_idx ON projects(user_id, is_collapsed);

-- Create index on user_id, parent_id and is_collapsed for faster hierarchical filtering
CREATE INDEX projects_user_parent_collapsed_idx ON projects(user_id, parent_id, is_collapsed);
