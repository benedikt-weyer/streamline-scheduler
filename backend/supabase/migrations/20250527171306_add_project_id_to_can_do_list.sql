-- Add project_id column to can_do_list table
ALTER TABLE can_do_list 
ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Create index on project_id for faster lookups
CREATE INDEX can_do_list_project_id_idx ON can_do_list(project_id);

-- Create index on user_id and project_id for faster filtering
CREATE INDEX can_do_list_user_project_idx ON can_do_list(user_id, project_id);