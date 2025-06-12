-- Add parent_id column to projects table for nested projects
ALTER TABLE projects 
ADD COLUMN parent_id UUID REFERENCES projects(id) ON DELETE CASCADE;

-- Create index on parent_id for faster lookups
CREATE INDEX projects_parent_id_idx ON projects(parent_id);

-- Create index on user_id and parent_id for faster filtering
CREATE INDEX projects_user_parent_idx ON projects(user_id, parent_id);

-- Prevent circular references by creating a constraint
-- This ensures a project cannot be a parent of itself (directly or indirectly)
CREATE OR REPLACE FUNCTION check_project_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
    current_id UUID;
    max_depth INTEGER := 10; -- Prevent infinite loops
    depth INTEGER := 0;
BEGIN
    -- If parent_id is NULL, no check needed
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Check if trying to set self as parent
    IF NEW.id = NEW.parent_id THEN
        RAISE EXCEPTION 'A project cannot be its own parent';
    END IF;
    
    -- Check for circular references by traversing up the hierarchy
    current_id := NEW.parent_id;
    
    WHILE current_id IS NOT NULL AND depth < max_depth LOOP
        -- If we reach the project we're trying to update, we have a cycle
        IF current_id = NEW.id THEN
            RAISE EXCEPTION 'Circular reference detected in project hierarchy';
        END IF;
        
        -- Move up to the next parent
        SELECT parent_id INTO current_id 
        FROM projects 
        WHERE id = current_id;
        
        depth := depth + 1;
    END LOOP;
    
    -- Check if we hit max depth (potential infinite loop)
    IF depth >= max_depth THEN
        RAISE EXCEPTION 'Project hierarchy too deep (max depth: %)', max_depth;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to check hierarchy on insert and update
CREATE TRIGGER check_project_hierarchy_trigger
    BEFORE INSERT OR UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION check_project_hierarchy();