# Docker Compose Setup for Streamline Scheduler

This Docker Compose configuration starts both the frontend (Next.js) and backend (Supabase) services.

## Quick Start

1. **Clone the repository** (if you haven't already)

2. **Create environment file**: Copy the environment variables you need. The Docker Compose file includes sensible defaults, but you may want to customize them:

```bash
# Create a .env file with your custom values
# All variables have defaults in docker-compose.yml, so this is optional
touch .env
```

3. **Start the services**:

```bash
docker compose up -d
```

4. **Access the applications**:
   - **Frontend**: http://localhost:3000
   - **Supabase API**: http://localhost:54321
   - **Supabase Studio**: http://localhost:54324 (username: `supabase`, password: `this_password_is_insecure_and_should_be_updated`)
   - **Database**: localhost:54322 (postgres/your-super-secret-and-long-postgres-password)

## Services Overview

### Frontend (`frontend`)
- **Technology**: Next.js with TypeScript
- **Port**: 3000
- **Dependencies**: Connects to Supabase backend

### Backend Services (Supabase Stack)
- **Kong API Gateway** (`kong`): Routes requests to appropriate services (Port 54321)
- **Supabase Studio** (`studio`): Database management UI (Port 54324)
- **Authentication** (`auth`): User authentication service
- **REST API** (`rest`): Automatic REST API for your database
- **Database** (`db`): PostgreSQL database (Port 54322)
- **Realtime** (`realtime`): Real-time subscriptions
- **Analytics** (`analytics`): Logging and analytics (Port 54327)
- **Meta** (`meta`): Database metadata API
- **Edge Functions** (`functions`): Serverless functions

## Environment Variables

The following environment variables can be customized (all have defaults):

### Database
- `POSTGRES_PASSWORD`: Database password (default: `your-super-secret-and-long-postgres-password`)
- `POSTGRES_HOST`: Database host (default: `db`)
- `POSTGRES_PORT`: Database port (default: `5432`)
- `POSTGRES_DB`: Database name (default: `postgres`)

### Security
- `JWT_SECRET`: JWT secret key (default: `your-super-secret-jwt-token-with-at-least-32-characters-long`)
- `ANON_KEY`: Anonymous access key (demo default provided)
- `SERVICE_ROLE_KEY`: Service role key (demo default provided)

### URLs
- `SUPABASE_PUBLIC_URL`: Public Supabase URL (default: `http://localhost:54321`)
- `API_EXTERNAL_URL`: External API URL (default: `http://localhost:54321`)
- `SITE_URL`: Frontend URL (default: `http://localhost:3000`)

### Ports
- `KONG_HTTP_PORT`: Kong HTTP port (default: `54321`)
- `KONG_HTTPS_PORT`: Kong HTTPS port (default: `54323`)
- `STUDIO_PORT`: Supabase Studio port (default: `54324`)

### Authentication
- `DISABLE_SIGNUP`: Disable user signup (default: `false`)
- `ENABLE_EMAIL_SIGNUP`: Enable email signup (default: `true`)
- `ENABLE_EMAIL_AUTOCONFIRM`: Auto-confirm emails (default: `true`)

### Email Configuration
- `SMTP_ADMIN_EMAIL`: Admin email
- `SMTP_HOST`: SMTP server host
- `SMTP_PORT`: SMTP server port
- `SMTP_USER`: SMTP username
- `SMTP_PASS`: SMTP password

## Development

### Viewing Logs
```bash
# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f frontend
docker compose logs -f kong
docker compose logs -f db
```

### Stopping Services
```bash
# Stop all services
docker compose down

# Stop and remove volumes (WARNING: This will delete your database data)
docker compose down -v
```

### Rebuilding
```bash
# Rebuild and restart services
docker compose up --build -d
```

## Production Considerations

For production use:

1. **Change default passwords and secrets**:
   - `POSTGRES_PASSWORD`
   - `JWT_SECRET`
   - `DASHBOARD_PASSWORD`
   - Generate new `ANON_KEY` and `SERVICE_ROLE_KEY`

2. **Configure email settings** for authentication:
   - Set proper SMTP configuration
   - Update `SMTP_ADMIN_EMAIL`, `SMTP_HOST`, etc.

3. **Update URLs** to match your domain:
   - `SUPABASE_PUBLIC_URL`
   - `API_EXTERNAL_URL`
   - `SITE_URL`

4. **Consider using external database** for better performance and backup options

5. **Set up proper SSL/TLS** termination (nginx reverse proxy, etc.)

## Troubleshooting

### Common Issues

1. **Port conflicts**: If ports are already in use, update the port mappings in `docker-compose.yml`

2. **Database connection issues**: Ensure the database service is healthy before other services start (Docker Compose handles this automatically)

3. **Frontend can't connect to backend**: Check that `NEXT_PUBLIC_SUPABASE_URL` matches your Kong gateway URL

4. **Permission issues**: On Linux/macOS, you might need to adjust file permissions for volume mounts

### Reset Everything
```bash
# Stop all services and remove all data
docker compose down -v --remove-orphans

# Remove all images (optional)
docker compose down --rmi all

# Start fresh
docker compose up -d
```

## File Structure

```
├── docker-compose.yml          # Main Docker Compose configuration
├── frontend/
│   ├── Dockerfile             # Frontend container configuration
│   ├── next.config.ts         # Next.js configuration (with standalone output)
│   └── ...                    # Frontend source code
└── backend/
    ├── volumes/               # Supabase configuration files
    │   ├── api/kong.yml       # Kong gateway configuration
    │   ├── db/                # Database initialization scripts
    │   └── functions/         # Edge functions
    └── ...                    # Other backend files
``` 