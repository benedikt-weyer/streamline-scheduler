{ 
  pkgs ? import <nixpkgs> {} 
}:

pkgs.mkShell {
  buildInputs = with pkgs; [
    # Node.js and related tools
    nodejs_20
    nodePackages.pnpm
    
    # Docker and Supabase CLI
    docker
    docker-compose
    supabase-cli

    # Useful tools
    curl
    jq
    git
    
    # For potential compilation needs
    gcc
    gnumake
  ];

  shellHook = ''
    # Print welcome message
    echo "🚀 Welcome to Streamline Scheduler development environment"
    echo "-----------------------------------------------------"
    echo "Available commands:"
    echo "  start      - Start both Supabase and Next.js dev servers"
    echo "  start:fe   - Start only Next.js dev server"
    echo "  start:be   - Start only Supabase dev server"
    echo "  test       - Run frontend tests"
    echo "  test:watch - Run frontend tests in watch mode"
    echo "-----------------------------------------------------"

    # Create a temporary directory for PID files
    export TEMP_DIR=$(mktemp -d)

    # Define function to start Supabase server
    start_supabase() {
      echo "🔋 Starting Supabase development server..."
      cd backend && supabase start
      cd ..
      echo "Supabase server started"
    }

    # Define function to start Next.js server
    start_nextjs() {
      echo "⚛️ Starting Next.js development server..."
      nohup bash -c "cd \"$(pwd)/frontend\" && pnpm dev" > /tmp/nextjs.log 2>&1 &
      echo "Next.js server started in background (logs at /tmp/nextjs.log)"
    }

    # Define function to stop all servers
    stop_all() {
      echo "🛑 Stopping all development servers..."
      
      # Stop Next.js server - find and kill the process
      pkill -f "pnpm dev" || true
      
      # Stop Supabase if running
      cd backend && supabase stop
      cd ..
      
      # Clean up temp directory
      rm -rf $TEMP_DIR
    }

    # Set up cleanup on exit
    trap stop_all EXIT

    # Define convenient aliases
    alias start='start_supabase && start_nextjs'
    alias start:fe='start_nextjs'
    alias start:be='start_supabase'
    alias test='cd frontend && pnpm test'
    alias test:watch='cd frontend && pnpm test:watch'

    # Ensure pnpm is properly set up in frontend directory
    if [ -d "frontend" ]; then
      echo "📦 Setting up frontend dependencies..."
      cd frontend
      if [ ! -d "node_modules" ]; then
        echo "Installing dependencies with pnpm..."
        pnpm install
      fi
      cd ..
    fi

    echo "✅ Development environment ready!"
    echo "Run 'start' to launch both Supabase and Next.js servers"
  '';

  # Set environment variables if needed
  # env = {
  #   SOME_ENV_VAR = "value";
  # };
}
