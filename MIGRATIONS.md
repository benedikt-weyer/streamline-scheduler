# Migration Container Usage Guide

This guide explains how to use the migration container defined in your Docker Compose setup for managing database schema changes in your Supabase-based application.

## Overview

The migration container is a dedicated service that handles database schema migrations. It's built from the main Dockerfile and has access to your Supabase database with all necessary migration tools pre-configured.

## Container Configuration

The migration service is configured with:
- **Build Context**: Root directory (uses main Dockerfile)
- **Database Access**: Full access to your Supabase PostgreSQL database
- **Working Directory**: `/app/supabase` (mounted from `./backend/supabase`)
- **Dependencies**: Waits for the database to be healthy before running
- **Network**: Connected to the `app-network` for database communication

## Prerequisites

1. Ensure Docker and Docker Compose are installed
2. Make sure your `.env` file contains the necessary database credentials:
   ```env
   POSTGRES_PASSWORD=your-super-secret-and-long-postgres-password
   POSTGRES_DB=postgres
   POSTGRES_PORT=5432
   ```
3. Ensure the `backend/supabase` directory exists with your migration files

## Directory Structure

Your migration files should be organized in the `backend/supabase` directory:
```
backend/supabase/
├── migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_add_users_table.sql
│   └── ...
└── config.toml (optional Supabase CLI config)
```

## Running Migrations

### Method 1: One-time Migration Run
```bash
# Run all pending migrations
docker compose run --rm migrations supabase db reset

# Or run migrations without reset
docker compose run --rm migrations supabase migration up
```

### Method 2: Interactive Migration Shell
```bash
# Access the migration container for manual operations
docker compose run --rm migrations bash

# Inside the container, you can run various Supabase CLI commands:
supabase migration list
supabase migration up
supabase db reset
```

### Method 3: Specific Migration Commands
```bash
# Apply a specific migration
docker compose run --rm migrations supabase migration up --target-version 20231201000000

# Check migration status
docker compose run --rm migrations supabase migration list
```

## Creating New Migrations

### Using Supabase CLI
```bash
# Generate a new migration file
docker compose run --rm migrations supabase migration new "add_projects_table"

# This creates a new SQL file in backend/supabase/migrations/
```

### Manual Creation
1. Create a new SQL file in `backend/supabase/migrations/`
2. Use the naming convention: `YYYYMMDDHHMMSS_description.sql`
3. Write your SQL migration code:
   ```sql
   -- Example migration file
   CREATE TABLE projects (
       id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
       name TEXT NOT NULL,
       description TEXT,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
       updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   -- Enable RLS (Row Level Security)
   ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
   
   -- Create policies
   CREATE POLICY "Users can view their own projects" ON projects
       FOR SELECT USING (auth.uid() = user_id);
   ```

## Common Migration Operations

### Database Reset and Seed
```bash
# Reset database and apply all migrations from scratch
docker compose run --rm migrations supabase db reset

# Reset and seed with test data
docker compose run --rm migrations supabase db reset --seed
```

### Migration Status and History
```bash
# List all migrations and their status
docker compose run --rm migrations supabase migration list

# Show detailed migration history
docker compose run --rm migrations supabase migration show --version 20231201000000
```

### Rollback Migrations
```bash
# Rollback to a specific migration
docker compose run --rm migrations supabase migration down --target-version 20231201000000

# Rollback the last migration
docker compose run --rm migrations supabase migration down
```

## Development Workflow

### 1. Start the Stack
```bash
# Start all services including database
docker compose up -d db analytics kong auth
```

### 2. Run Initial Migrations
```bash
# Apply all existing migrations
docker compose run --rm migrations supabase migration up
```

### 3. Develop and Test
```bash
# Create new migration
docker compose run --rm migrations supabase migration new "add_feature_x"

# Edit the generated SQL file
# Test the migration
docker compose run --rm migrations supabase migration up

# If issues occur, rollback and fix
docker compose run --rm migrations supabase migration down
```

### 4. Production Deployment
```bash
# Apply migrations in production
docker compose run --rm migrations supabase migration up --environment production
```

## Best Practices

### Migration File Guidelines
1. **Always test migrations locally first**
2. **Make migrations reversible when possible**
3. **Use descriptive names for migration files**
4. **Include both forward and backward migration logic**
5. **Add comments explaining complex changes**

### Example Migration Template
```sql
-- Migration: Add user profiles table
-- Created: 2023-12-01
-- Description: Adds user profiles with avatar and bio fields

-- Forward migration
CREATE TABLE user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view all profiles" ON user_profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Add indexes
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);

-- Rollback instructions (comment):
-- To rollback: DROP TABLE user_profiles CASCADE;
```

## Troubleshooting

### Common Issues

1. **Container won't start**
   ```bash
   # Check logs
   docker compose logs migrations
   
   # Ensure database is healthy
   docker compose ps
   ```

2. **Migration fails**
   ```bash
   # Check migration syntax
   docker compose run --rm migrations supabase migration show --version YYYYMMDDHHMMSS
   
   # Rollback and fix
   docker compose run --rm migrations supabase migration down
   ```

3. **Database connection issues**
   - Verify environment variables in `.env`
   - Ensure database service is running and healthy
   - Check network connectivity

### Debug Mode
```bash
# Run with verbose output
docker compose run --rm migrations supabase --debug migration up

# Access database directly for debugging
docker compose exec db psql -U postgres -d postgres
```

## Environment Variables

The migration container uses these key environment variables:

- `SUPABASE_DB_URL`: Database connection string
- `POSTGRES_PASSWORD`: Database password
- `POSTGRES_DB`: Database name
- `POSTGRES_PORT`: Database port

## Integration with Development

### VS Code Integration
If using VS Code, you can create tasks for common migration operations:

```json
// .vscode/tasks.json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "Run Migrations",
            "type": "shell",
            "command": "docker compose run --rm migrations supabase migration up",
            "group": "build"
        },
        {
            "label": "Create Migration",
            "type": "shell",
            "command": "docker compose run --rm migrations supabase migration new",
            "group": "build"
        }
    ]
}
```

### Scripts Integration
You can add these commands to your `package.json` or create shell scripts:

```bash
#!/bin/bash
# scripts/migrate.sh
case "$1" in
    "up")
        docker compose run --rm migrations supabase migration up
        ;;
    "down")
        docker compose run --rm migrations supabase migration down
        ;;
    "new")
        docker compose run --rm migrations supabase migration new "$2"
        ;;
    "reset")
        docker compose run --rm migrations supabase db reset
        ;;
    *)
        echo "Usage: $0 {up|down|new|reset}"
        exit 1
        ;;
esac
```

## Conclusion

The migration container provides a consistent and isolated environment for managing your database schema changes. By following this guide, you can effectively manage your database migrations throughout your development and deployment lifecycle.

For more advanced Supabase CLI features, refer to the [official Supabase CLI documentation](https://supabase.com/docs/reference/cli). 