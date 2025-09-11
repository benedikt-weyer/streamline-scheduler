# Streamline Scheduler

Streamline Scheduler is an open source self-hostable calendar-todolist combo with end-to-end encryption, which provides fast and efficient streamlined scheduling of tasks and events. It can be used as a standalone todolist app and/or calendar app. The frontend is built with SvelteKit, Tailwind CSS, and features client-side encryption. The backend uses a custom Rust API with Axum framework and PostgreSQL. Privacy-focused and easy self-hosting first.

## Features

- 📅 **Calendar Management** - Create, edit, and manage events with support for recurring patterns
- ✅ **Todo List** - Efficient task management with priorities and due dates
- 🔄 **Recurring Events & Tasks** - Set up repeating events and tasks with flexible patterns
- 🔒 **End-to-End Encryption** - All data is encrypted client-side before transmission
- 🏠 **Easy Self-Hosting** - Simple deployment options for personal or team use
- 🎨 **Modern UI** - Beautiful, responsive interface built with SvelteKit and Tailwind CSS
- ⚡ **Real-time Sync** - WebSocket-based real-time updates across all devices
- 🌙 **Dark Mode** - Full dark/light theme support
- 🗂️ **Project Organization** - Hierarchical project structure with drag-and-drop reordering

## Architecture

### New Architecture (Current)
- **Frontend**: SvelteKit with Tailwind CSS 4, crypto-js for E2E encryption
- **Backend**: Rust with Axum framework, SeaORM, PostgreSQL
- **Real-time**: WebSocket implementation for instant synchronization
- **Security**: Client-side encryption with PBKDF2 key derivation
- **Package Manager**: pnpm

### Legacy Architecture (Deprecated)
- **Frontend**: Next.js 14+, React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Real-time subscriptions)

## Tech Stack

- **Frontend**: SvelteKit 5, TypeScript, Tailwind CSS 4, crypto-js, dnd-kit-svelte
- **Backend**: Rust, Axum, SeaORM, PostgreSQL, JWT authentication
- **Development**: Nix shell environment, Docker, pnpm
- **Security**: End-to-end encryption, client-side key derivation

## Self-Hosting

Streamline Scheduler can be easily self-hosted on your own server or cloud provider using the new Rust backend architecture.

### Quick Start with Docker Compose (Recommended)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/streamline-scheduler.git
   cd streamline-scheduler
   ```

2. **Set up environment variables**:
   ```bash
   # Create environment file for the backend
   cp backend_new/env.example backend_new/.env
   
   # Create environment file for the frontend
   cp frontend_new/env.example frontend_new/.env
   
   # Edit the environment files with your settings
   # Set strong passwords, JWT secrets, and database configuration
   ```

3. **Deploy with Docker Compose**:
   ```bash
   # Start all services (PostgreSQL, Rust backend, SvelteKit frontend)
   docker-compose up -d
   ```

4. **Access the application**:
   - Frontend: https://localhost:443 (with SSL) or http://localhost:3000
   - Backend API: http://localhost:3001

### Environment Variables

Key environment variables to configure:

#### Backend (.env)
```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@db:5432/postgres

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long

# Server
PORT=3001
```

#### Frontend (.env)
```bash
# Backend API URL
VITE_BACKEND_URL=http://localhost:3001
```

#### Docker Compose (.env)
```bash
# PostgreSQL Configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=postgres
POSTGRES_PORT=5432

# Service Ports
BACKEND_PORT=3001
FRONTEND_PORT=3000

# JWT Secret (should match backend)
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long
```

### Security Features

- **End-to-End Encryption**: All sensitive data is encrypted client-side using AES-CBC
- **Master Password**: Users provide a master password for key derivation (never sent to server)
- **PBKDF2 Key Derivation**: Strong key derivation with 10,000 iterations
- **Zero Knowledge**: Server never has access to unencrypted user data
- **JWT Authentication**: Secure token-based authentication
- **Row Level Security**: Application-level data isolation

### Manual Server Deployment

1. **Server Requirements**:
   - Ubuntu 20.04+ or similar Linux distribution
   - Docker and Docker Compose
   - Nginx (for reverse proxy and SSL)
   - SSL certificate (Let's Encrypt recommended)

2. **Install Dependencies**:
   ```bash
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   
   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

3. **Deploy Application**:
   ```bash
   # Clone repository
   git clone https://github.com/your-username/streamline-scheduler.git
   cd streamline-scheduler
   
   # Set up production environment
   cp backend_new/env.example backend_new/.env.production
   cp frontend_new/env.example frontend_new/.env.production
   # Edit .env.production files with production settings
   
   # Start services
   docker-compose up -d
   ```

4. **Configure Nginx** (example):
   ```nginx
   server {
       listen 443 ssl http2;
       server_name your-domain.com;
       
       ssl_certificate /path/to/certificate.crt;
       ssl_certificate_key /path/to/private.key;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
       
       location /api/ {
           proxy_pass http://localhost:3001/;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
       
       location /ws {
           proxy_pass http://localhost:3001/ws;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

### Backup and Maintenance

```bash
# Database backup
docker exec streamline-db pg_dump -U postgres postgres > backup.sql

# Restore database
docker exec -i streamline-db psql -U postgres postgres < backup.sql

# Update application
git pull origin main
docker-compose down
docker-compose pull
docker-compose up -d

# View logs
docker-compose logs -f backend_new
docker-compose logs -f frontend
```

## Development

### Prerequisites

- Node.js 20.x or later
- pnpm
- Rust (for backend development)
- Docker and Docker Compose
- Nix (optional, for complete environment)

### Development Setup

#### Option 1: Using Nix (Recommended)

The project includes a comprehensive `shell.nix` file that sets up a complete development environment with all necessary dependencies.

1. **Install Nix**:
   - Follow the [official Nix installation guide](https://nixos.org/download.html)

2. **Enter the development environment**:
   ```bash
   cd streamline-scheduler
   nix-shell
   ```

3. **Start development servers**:
   ```bash
   # Start PostgreSQL database
   docker-compose up -d db
   
   # Start Rust backend (in one terminal)
   cd backend_new
   cargo run
   
   # Start SvelteKit frontend (in another terminal)
   cd frontend_new
   pnpm dev
   ```

#### Option 2: Manual Setup

1. **Install Prerequisites**:
   ```bash
   # Install Rust
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   
   # Install Node.js and pnpm
   # Install Docker and Docker Compose
   ```

2. **Setup Backend**:
   ```bash
   cd backend_new
   
   # Set up environment
   cp env.example .env
   
   # Start database
   docker-compose up -d db
   
   # Run migrations and start server
   cargo run
   ```

3. **Setup Frontend**:
   ```bash
   cd frontend_new
   
   # Install dependencies
   pnpm install
   
   # Set up environment
   cp env.example .env.local
   
   # Start development server
   pnpm dev
   ```

4. **Access the application**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001
   - Database: localhost:5432

### Project Structure

```
streamline-scheduler/
├── frontend_new/            # SvelteKit frontend application
│   ├── src/
│   │   ├── lib/            # Shared libraries
│   │   │   ├── api/        # API client
│   │   │   ├── crypto/     # Encryption utilities
│   │   │   └── stores/     # Svelte stores
│   │   └── routes/         # SvelteKit routes
│   ├── Dockerfile          # Frontend container
│   └── package.json
├── backend_new/             # Rust backend application
│   ├── src/
│   │   ├── entities/       # Database entities (SeaORM)
│   │   ├── handlers/       # API route handlers
│   │   ├── migrator/       # Database migrations
│   │   └── models/         # Request/response models
│   ├── Cargo.toml
│   └── Dockerfile          # Backend container
├── docker-compose.yml       # Complete stack deployment
├── nginx.conf              # Nginx configuration
└── shell.nix               # Nix development environment
```

### Development Workflow

1. **Fork and Clone**: Fork the repository and clone your fork
2. **Create a Branch**: Create a new branch for your feature or bugfix
3. **Set Up Environment**: Use one of the development setup options above
4. **Make Changes**: Implement your changes following the project conventions
5. **Test**: Test your changes with both frontend and backend
6. **Create Migrations**: If you changed the database schema, add SeaORM migrations
7. **Commit and Push**: Commit your changes and push to your fork
8. **Submit PR**: Submit a pull request with a clear description

## Migration from Legacy Architecture

If you're migrating from the old Supabase-based architecture:

1. **Backup your data** from Supabase
2. **Deploy the new stack** using the Docker Compose setup
3. **Create an account** in the new system
4. **Import your data** (migration scripts coming soon)

The new architecture provides better privacy with E2E encryption and more control over your data.

## Contributing

We welcome contributions from the community! Please see the development setup above and feel free to:

- Report bugs and issues
- Suggest new features
- Submit pull requests
- Improve documentation

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

- 📖 **Documentation**: Check the project wiki and README files
- 🐛 **Bug Reports**: Open an issue on GitHub
- 💡 **Feature Requests**: Open a discussion on GitHub
- 🔒 **Security Issues**: Report privately via email