{ 
  pkgs ? import (fetchTarball "https://github.com/NixOS/nixpkgs/archive/nixos-unstable.tar.gz") {}
}:

pkgs.mkShell {
  buildInputs = with pkgs; [
    # Node.js and related tools
    nodejs_20
    nodePackages.pnpm
    
    # Supabase CLI
    supabase-cli

    # Rust toolchain
    rustc
    cargo
    rustfmt
    clippy

    # Useful tools
    curl
    jq
    git
  ];

  shellHook = ''
    # Save the project directory
    export PROJECT_DIR=$(pwd)
    
    # Print welcome message
    echo "🚀 Welcome to Streamline Scheduler development environment"
    echo "-----------------------------------------------------"
    echo "Available commands:"
    echo "  start      - Start both Supabase and Next.js dev servers"
    echo "  start:fe   - Start only Next.js dev server"
    echo "  start:be   - Start only Supabase dev server"
    echo "  stop       - Stop all development servers"
    echo "  stop:fe    - Stop only Next.js dev server"
    echo "  stop:be    - Stop only Supabase dev server"
    echo "  restart    - Restart all development servers"
    echo "  restart:fe - Restart only Next.js dev server"
    echo "  restart:be - Restart only Supabase dev server"
    echo "  test       - Run frontend tests"
    echo "  test:watch - Run frontend tests in watch mode"
    echo "  migrate    - Create a new Supabase migration (Usage: migrate <migration_name>)"
    echo "-----------------------------------------------------"

    # Create a temporary directory for PID files
    export TEMP_DIR=$(mktemp -d)

    # Define function to start Supabase server
    start_supabase() {
      echo "🔋 Starting Supabase development server..."
      cd "$PROJECT_DIR/backend" && supabase start
      cd "$PROJECT_DIR"
      echo "Supabase server started"
    }

    # Define function to start Next.js server
    start_nextjs() {
      echo "⚛️ Starting Next.js development server..."
      nohup bash -c "cd \"$PROJECT_DIR/frontend\" && pnpm dev" > /tmp/nextjs.log 2>&1 &
      echo "Next.js server started in background (logs at /tmp/nextjs.log)"
      echo -e "📱 Access the app at \e]8;;http://localhost:3000\e\\http://localhost:3000\e]8;;\e\\"
      
      # Wait a moment for the server to start, then open browser
      sleep 3
      echo "🌐 Opening browser..."
      if command -v xdg-open > /dev/null; then
        xdg-open http://localhost:3000
      elif command -v open > /dev/null; then
        open http://localhost:3000
      else
        echo "⚠️  Could not auto-open browser. Please visit http://localhost:3000 manually"
      fi
    }

    # Define function to stop Next.js server only
    stop_nextjs() {
      echo "🛑 Stopping Next.js development server..."
      pkill -f "pnpm dev" || true
      echo "✅ Next.js server stopped"
    }

    # Define function to stop Supabase server only
    stop_supabase() {
      echo "🛑 Stopping Supabase development server..."
      cd "$PROJECT_DIR/backend" && supabase stop
      cd "$PROJECT_DIR"
      echo "✅ Supabase server stopped"
    }

    # Define function to stop all servers
    stop_all() {
      echo "🛑 Stopping all development servers..."
      
      # Stop Next.js server - find and kill the process
      pkill -f "pnpm dev" || true
      
      # Stop Supabase if running - ensure we're in project directory
      cd "$PROJECT_DIR/backend" && supabase stop
      
      # Return to project directory
      cd "$PROJECT_DIR"
      
      # Clean up temp directory
      rm -rf $TEMP_DIR
      
      echo "✅ All servers stopped"
    }

    # Define function to restart Next.js server only
    restart_nextjs() {
      echo "🔄 Restarting Next.js development server..."
      stop_nextjs
      sleep 1
      start_nextjs
    }

    # Define function to restart Supabase server only
    restart_supabase() {
      echo "🔄 Restarting Supabase development server..."
      stop_supabase
      sleep 1
      start_supabase
    }

    # Define function to restart all servers
    restart_all() {
      echo "🔄 Restarting all development servers..."
      stop_all
      sleep 2
      start_supabase && start_nextjs
    }

    # Set up cleanup on exit
    trap stop_all EXIT

    # Define convenient aliases
    alias start='start_supabase && start_nextjs'
    alias start:fe='start_nextjs'
    alias start:be='start_supabase'
    alias stop='stop_all'
    alias stop:fe='stop_nextjs'
    alias stop:be='stop_supabase'
    alias restart='restart_all'
    alias restart:fe='restart_nextjs'
    alias restart:be='restart_supabase'
    alias test='cd "$PROJECT_DIR/frontend" && pnpm test'
    alias test:watch='cd "$PROJECT_DIR/frontend" && pnpm test:watch'
    
    # Create migration alias - accepts a migration name as parameter
    create_migration() {
      if [ -z "$1" ]; then
        echo "❌ Error: Migration name is required"
        echo "Usage: create_migration <migration_name>"
        return 1
      fi
      
      echo "🔄 Creating migration: $1"
      cd "$PROJECT_DIR/backend" && supabase migration new "$1"
      cd "$PROJECT_DIR"
      echo "✅ Migration created successfully"
    }
    alias migrate='create_migration'

    # Ensure pnpm is properly set up in frontend directory
    if [ -d "$PROJECT_DIR/frontend" ]; then
      echo "📦 Setting up frontend dependencies..."
      cd "$PROJECT_DIR/frontend"
      if [ ! -d "node_modules" ]; then
        echo "Installing dependencies with pnpm..."
        pnpm install
      fi
      cd "$PROJECT_DIR"
    fi

    echo "✅ Development environment ready!"
    echo "Run 'start' to launch both Supabase and Next.js servers"
  '';

  # Set environment variables if needed
  # env = {
  #   SOME_ENV_VAR = "value";
  # };
}
