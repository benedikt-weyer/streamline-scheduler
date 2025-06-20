#!/bin/bash

# Development Setup Script for Streamline Scheduler
# This script sets up the application for local development

set -e

echo "🛠️  Streamline Scheduler Development Setup"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Setting up development environment...${NC}"

# Create .env file with development defaults if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "${BLUE}📝 Creating .env file with development defaults...${NC}"
    
    cat > .env << 'EOF'
# Streamline Scheduler Development Configuration

# Database Configuration
POSTGRES_PASSWORD=your-super-secret-and-long-postgres-password
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=postgres

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long
JWT_EXPIRY=3600

# Supabase Keys (Development - Demo keys)
ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# Encryption Keys
VAULT_ENC_KEY=your-super-secret-vault-encryption-key-with-32-chars
SECRET_KEY_BASE=UpNVntn3cDxHJpq99YMc1T1AQgQpc8kfYTuRgBiYa15BLrx8etQoXz3gZv1/u2oq

# Dashboard Access
DASHBOARD_USERNAME=supabase
DASHBOARD_PASSWORD=this_password_is_insecure_and_should_be_updated

# URLs (Development)
SUPABASE_PUBLIC_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
API_EXTERNAL_URL=http://localhost:54321
SITE_URL=http://localhost:3000
ADDITIONAL_REDIRECT_URLS=

# Ports
FRONTEND_PORT=3000
KONG_HTTP_PORT=54321
KONG_HTTPS_PORT=54323
STUDIO_PORT=54324

# Authentication (Development - Auto-confirm enabled)
DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
ENABLE_PHONE_SIGNUP=true
ENABLE_PHONE_AUTOCONFIRM=true
ENABLE_ANONYMOUS_USERS=false

# Email Configuration (Development - can be fake)
SMTP_ADMIN_EMAIL=admin@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.email@gmail.com
SMTP_PASS=your-gmail-password
SMTP_SENDER_NAME=Streamline Scheduler Dev

# Email URL Paths
MAILER_URLPATHS_INVITE=/auth/v1/verify
MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify
MAILER_URLPATHS_RECOVERY=/auth/v1/verify
MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify

# Database Schema
PGRST_DB_SCHEMAS=public,graphql_public

# Analytics
LOGFLARE_API_KEY=your-super-secret-and-long-logflare-key

# Edge Functions
VERIFY_JWT=false

# Organization
STUDIO_DEFAULT_ORGANIZATION=Default Organization
STUDIO_DEFAULT_PROJECT=Default Project
OPENAI_API_KEY=
EOF
    
    echo -e "${GREEN}✓ .env file created${NC}"
else
    echo -e "${YELLOW}⚠️  .env file already exists, skipping...${NC}"
fi

# Create frontend .env.local if it doesn't exist
if [ ! -f "frontend/.env.local" ]; then
    echo -e "${BLUE}📝 Creating frontend/.env.local...${NC}"
    
    cat > frontend/.env.local << 'EOF'
# Frontend Development Environment Variables

NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
NEXT_PUBLIC_VERCEL_URL=http://localhost:3000
EOF
    
    echo -e "${GREEN}✓ frontend/.env.local created${NC}"
else
    echo -e "${YELLOW}⚠️  frontend/.env.local already exists, skipping...${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Development setup completed!${NC}"
echo ""
echo -e "${BLUE}🚀 To start the application:${NC}"
echo "   docker compose up -d"
echo ""
echo -e "${BLUE}🔧 Access URLs:${NC}"
echo "   • Frontend: http://localhost:3000"
echo "   • Supabase API: http://localhost:54321"
echo "   • Supabase Studio: http://localhost:54324"
echo "   • Database: localhost:54322"
echo ""
echo -e "${BLUE}🔑 Supabase Studio Login:${NC}"
echo "   • Username: supabase"
echo "   • Password: this_password_is_insecure_and_should_be_updated"
echo ""
echo -e "${GREEN}✨ Happy coding!${NC}" 