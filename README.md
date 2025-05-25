# Streamline Scheduler

Streamline Scheduler is an open source self-hostable calendar-todolist combo, which provides fast and efficient streamlined scheduling of tasks and events. It can be used as a standalone todolist app and/or calendar app. The frontend is built with Next.js, shadcn/ui components, and Tailwind CSS. The backend uses Supabase for authentication and data storage. Privacy-focused and easy self-hosting first.

## Features

- 📅 **Calendar Management** - Create, edit, and manage events with support for recurring patterns
- ✅ **Todo List** - Efficient task management with priorities and due dates
- 🔄 **Recurring Events & Tasks** - Set up repeating events and tasks with flexible patterns
- 🔒 **Privacy-Focused** - Your data stays on your server
- 🏠 **Easy Self-Hosting** - Simple deployment options for personal or team use
- 🎨 **Modern UI** - Beautiful, responsive interface built with shadcn/ui
- 🌙 **Dark Mode** - Full dark/light theme support

## Tech Stack

- **Frontend**: Next.js 14+, React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Real-time subscriptions)
- **Package Manager**: pnpm
- **Development**: Nix shell environment, Supabase CLI

## Self-Hosting

Streamline Scheduler can be easily self-hosted on your own server or cloud provider. Here are several deployment options:

### Option 1: Docker Compose Deployment (Recommended)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/streamline-scheduler.git
   cd streamline-scheduler
   ```

2. **Set up environment variables**:
   ```bash
   # Create environment file
   cp backend/.env.example backend/.env
   
   # Edit the environment file with your settings
   # Set strong passwords, API keys, and domain configuration
   ```

3. **Deploy with Docker Compose**:
   ```bash
   cd backend
   docker-compose -f docker-compose.yml up -d
   
   # Build and deploy frontend
   cd ../frontend
   docker build -t streamline-scheduler-frontend .
   docker run -d -p 3000:3000 --name streamline-frontend streamline-scheduler-frontend
   ```

### Option 2: Supabase Cloud + Vercel Deployment

1. **Set up Supabase Cloud**:
   - Create a new project at [supabase.com](https://supabase.com)
   - Run migrations:
     ```bash
     cd backend
     supabase link --project-ref your-project-ref
     supabase db push
     ```

2. **Deploy Frontend to Vercel**:
   ```bash
   cd frontend
   # Set environment variables in Vercel dashboard
   # Deploy using Vercel CLI or GitHub integration
   vercel deploy --prod
   ```

### Option 3: Manual Server Deployment

1. **Server Requirements**:
   - Ubuntu 20.04+ or similar Linux distribution
   - Docker and Docker Compose
   - Nginx (for reverse proxy)
   - SSL certificate (Let's Encrypt recommended)

2. **Install Dependencies**:
   ```bash
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   
   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

3. **Deploy Application**:
   ```bash
   # Clone repository
   git clone https://github.com/your-username/streamline-scheduler.git
   cd streamline-scheduler
   
   # Set up production environment
   cp backend/.env.example backend/.env.production
   # Edit .env.production with production settings
   
   # Start services
   cd backend
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

4. **Configure Nginx**:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
       
       location /api/ {
           proxy_pass http://localhost:54321/;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

5. **Set up SSL with Let's Encrypt**:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

### Environment Variables

Key environment variables to configure for production:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/streamline
JWT_SECRET=your-jwt-secret

# Frontend
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional: Analytics, Error Tracking
NEXT_PUBLIC_ANALYTICS_ID=your-analytics-id
```

### Security Considerations

- **Use strong passwords** for all database and service accounts
- **Enable SSL/TLS** for all connections
- **Configure firewall** to only allow necessary ports (80, 443, 22)
- **Regular backups** of your database
- **Keep services updated** with security patches
- **Use environment variables** for all sensitive configuration

### Backup and Maintenance

```bash
# Database backup
docker exec supabase-db pg_dump -U postgres streamline > backup.sql

# Update application
git pull origin main
docker-compose down
docker-compose pull
docker-compose up -d

# View logs
docker-compose logs -f
```

## Deployment

For production deployment, consider:

1. **Cloud Providers**: AWS, Google Cloud, DigitalOcean, Hetzner
2. **Container Orchestration**: Kubernetes, Docker Swarm
3. **CDN**: CloudFlare, AWS CloudFront for static assets
4. **Monitoring**: Set up monitoring and alerting for your deployment
5. **Automated Backups**: Schedule regular database backups


## Contributing

We welcome contributions from the community! Here's how to set up the development environment.

### Prerequisites

- Node.js 20.x or later
- pnpm
- Supabase CLI
- Docker and Docker Compose (for local Supabase development)

### Development Setup

#### Option 1: Using Nix (Recommended)

The project includes a comprehensive `shell.nix` file that sets up a complete development environment with all necessary dependencies, including Node.js, pnpm, and Supabase CLI.

1. **Install Nix**:
   - Follow the [official Nix installation guide](https://nixos.org/download.html)
   - For single-user installation: `sh <(curl -L https://nixos.org/nix/install) --no-daemon`
   - For multi-user installation: `sh <(curl -L https://nixos.org/nix/install) --daemon`

2. **Enter the development environment**:
   ```bash
   cd streamline-scheduler
   nix-shell
   ```

3. **Use the provided commands**:
   ```bash
   # Start both Supabase and Next.js dev servers
   start
   
   # Start only the Next.js frontend
   start:fe
   
   # Start only the Supabase backend
   start:be
   
   # Stop all servers
   stop
   
   # Restart servers
   restart
   
   # Run tests
   test
   
   # Run tests in watch mode
   test:watch
   
   # Create a new Supabase migration
   migrate <migration_name>
   ```

4. **Access the application**:
   - Frontend: http://localhost:3000
   - Supabase Studio: http://localhost:54323

5. When you're done, simply type `exit` or press `Ctrl+D` to exit the Nix shell. All development servers will be automatically stopped.

> **Note**: For direnv users, an `.envrc` file is included that will automatically load the Nix environment when you enter the project directory.

#### Option 2: Manual Setup with Supabase CLI (Recommended for Advanced Users)

This setup uses the Supabase CLI directly, which is ideal for database migrations and advanced development workflows.

1. **Install Prerequisites**:
   ```bash
   # Install Node.js 20+ and pnpm
   # Install Docker and Docker Compose
   # Install Supabase CLI
   npm install -g supabase
   ```

2. **Setup Frontend**:
   ```bash
   cd frontend
   pnpm install
   ```

3. **Setup Backend**:
   ```bash
   cd backend
   supabase start
   ```
   This will:
   - Start Supabase services (PostgreSQL, Auth, Storage, etc.)
   - Apply all migrations
   - Set up the local development database

4. **Start Development Servers**:
   ```bash
   # Terminal 1: Start frontend
   cd frontend
   pnpm dev
   
   # Terminal 2: Backend is already running from supabase start
   ```

5. **Useful Supabase CLI Commands**:
   ```bash
   # Create a new migration
   cd backend
   supabase migration new <migration_name>
   
   # Reset database (careful: destroys all data)
   supabase db reset
   
   # View database diff
   supabase db diff
   
   # Stop Supabase services
   supabase stop
   
   # View logs
   supabase logs
   ```

6. **Access the application**:
   - Frontend: http://localhost:3000
   - Supabase Studio: http://localhost:54323

#### Option 3: Manual Setup with Docker Compose (Legacy)

If you prefer using Docker Compose directly without the Supabase CLI:

1. **Setup Frontend**:
   ```bash
   cd frontend
   pnpm install
   pnpm dev
   ```

2. **Setup Backend**:
   ```bash
   cd backend
   docker-compose -f docker-compose.yml -f dev/docker-compose.dev.yml up -d
   ```

3. **Stop services**:
   ```bash
   cd backend
   docker-compose -f docker-compose.yml -f dev/docker-compose.dev.yml down
   ```

### Development Workflow

1. **Fork and Clone**: Fork the repository and clone your fork
2. **Create a Branch**: Create a new branch for your feature or bugfix
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Set Up Environment**: Use one of the development setup options above
4. **Make Changes**: Implement your changes following the project conventions
5. **Write Tests**: Add or update tests for your changes
6. **Run Tests**: Ensure all tests pass
   ```bash
   test        # Run once
   test:watch  # Run in watch mode
   ```
7. **Create Migrations**: If you changed the database schema
   ```bash
   migrate your_migration_name
   ```
8. **Commit and Push**: Commit your changes and push to your fork
9. **Submit PR**: Submit a pull request with a clear description

### Project Structure

```
streamline-scheduler/
├── frontend/                 # Next.js frontend application
│   ├── app/                 # Next.js app router pages
│   ├── components/          # Reusable UI components (shadcn/ui)
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utility libraries
│   ├── utils/               # Helper functions
│   └── test/                # Frontend tests
├── backend/                 # Supabase backend configuration
│   ├── supabase/           # Supabase project configuration
│   │   ├── config.toml     # Supabase configuration
│   │   ├── migrations/     # Database migrations
│   │   └── seed.sql        # Initial data
│   └── dev/                # Development configurations
└── shell.nix               # Nix development environment
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

- 📖 **Documentation**: Check the wiki for detailed guides
- 🐛 **Bug Reports**: Open an issue on GitHub
- 💡 **Feature Requests**: Open a discussion on GitHub
- 💬 **Community**: Join our Discord server (if available)
