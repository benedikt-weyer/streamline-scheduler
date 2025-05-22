# Streamline Scheduler

Streamline Scheduler is an open source self-hostable calendar-todolist combo, which provides fast and efficient streamlined scheduling of tasks and events. It can be used as a standalone todolist app and/or calendar app. The frontend is made with NextJS, shadcn/ui-components and Tailwind. The backend uses Supabase for authentication and data storage. Privacy and easy self-hosting first.

## Features

- Calendar with event management
- Todo list with task management
- Recurring events and tasks
- Privacy-focused design
- Easy self-hosting

## Getting Started

### Prerequisites

- Node.js 20.x or later
- pnpm
- Docker and Docker Compose (for Supabase)

## Contributing

We welcome contributions from the community! Here's how to set up the development environment.

### Development Setup

#### Option 1: Using Nix (Recommended)

The project includes a `shell.nix` file that sets up a complete development environment with all necessary dependencies.

1. **Install Nix**:
   - Follow the [official Nix installation guide](https://nixos.org/download.html)
   - For single-user installation: `sh <(curl -L https://nixos.org/nix/install) --no-daemon`
   - For multi-user installation: `sh <(curl -L https://nixos.org/nix/install) --daemon`

2. **Enter the development environment**:
   ```bash
   cd streamline-scheduler
   nix-shell
   ```

3. **Use the provided aliases**:
   ```bash
   # Start both Supabase and Next.js dev servers
   start
   
   # Start only the Next.js frontend
   start:fe
   
   # Start only the Supabase backend
   start:be
   
   # Run tests
   test
   
   # Run tests in watch mode
   test:watch
   ```

4. When you're done, simply type `exit` or press `Ctrl+D` to exit the Nix shell. All development servers will be automatically stopped.

For direnv users, an `.envrc` file is included that will automatically load the Nix environment when you enter the project directory.

#### Option 2: Manual Setup (Without Nix)

If you don't want to use Nix, you can set up the development environment manually:

1. **Setup Frontend**:
   ```bash
   # Navigate to frontend directory
   cd frontend
   
   # Install dependencies
   pnpm install
   
   # Start the development server
   pnpm dev
   ```

2. **Setup Backend (Supabase)**:
   ```bash
   # Navigate to backend directory
   cd backend
   
   # Start Supabase in development mode
   docker-compose -f docker-compose.yml -f dev/docker-compose.dev.yml up -d
   ```

3. **Run Tests**:
   ```bash
   cd frontend
   pnpm test
   ```

4. **Stop the Supabase server** when you're done:
   ```bash
   cd backend
   docker-compose -f docker-compose.yml -f dev/docker-compose.dev.yml down
   ```

### Development Workflow

1. Create a new branch for your feature or bugfix
2. Make your changes
3. Write or update tests as needed
4. Ensure all tests pass
5. Submit a pull request

## Deployment

// Deployment instructions here

## License

This project is licensed under the MIT License - see the LICENSE file for details.
