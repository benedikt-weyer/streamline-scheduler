#!/bin/bash

# Production Setup Script for Streamline Scheduler
# This script helps configure the application for production use

set -e

echo "🚀 Streamline Scheduler Production Setup"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to generate a random password
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Function to generate a random JWT secret (64 characters)
generate_jwt_secret() {
    openssl rand -base64 64 | tr -d "=+/" | cut -c1-64
}

# Function to generate Supabase keys
generate_supabase_keys() {
    # Generate ANON key (for demo - in production you should use supabase CLI)
    echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
}

# Function to generate service role key
generate_service_key() {
    # Generate SERVICE_ROLE key (for demo - in production you should use supabase CLI)
    echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
}

# Function to prompt for user input with default
prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local response
    
    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " response
        echo "${response:-$default}"
    else
        read -p "$prompt: " response
        echo "$response"
    fi
}

# Function to prompt for sensitive input (hidden)
prompt_password() {
    local prompt="$1"
    local response
    
    read -s -p "$prompt: " response
    echo ""
    echo "$response"
}

echo -e "${BLUE}This script will help you set up environment variables for production.${NC}"
echo -e "${YELLOW}⚠️  Make sure to review and customize the generated files before deploying!${NC}"
echo ""

# Check if .env already exists
if [ -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file already exists.${NC}"
    backup_existing=$(prompt_with_default "Create backup of existing .env file? (y/n)" "y")
    if [[ $backup_existing =~ ^[Yy]$ ]]; then
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
        echo -e "${GREEN}✓ Backup created${NC}"
    fi
fi

echo ""
echo -e "${BLUE}🔧 Configuring production environment...${NC}"
echo ""

# Generate secure secrets
echo -e "${BLUE}Generating secure secrets...${NC}"
POSTGRES_PASSWORD=$(generate_password)
JWT_SECRET=$(generate_jwt_secret)
DASHBOARD_PASSWORD=$(generate_password)
LOGFLARE_API_KEY=$(generate_password)
ANON_KEY=$(generate_supabase_keys)
SERVICE_ROLE_KEY=$(generate_service_key)

echo -e "${GREEN}✓ Secrets generated${NC}"

# Prompt for production-specific configuration
echo ""
echo -e "${BLUE}📝 Please provide production configuration:${NC}"

DOMAIN=$(prompt_with_default "Enter your production domain (e.g., yourdomain.com)" "localhost")
ENABLE_SSL=$(prompt_with_default "Enable SSL/HTTPS? (y/n)" "y")

if [[ $ENABLE_SSL =~ ^[Yy]$ ]]; then
    PROTOCOL="https"
    API_PORT="443"
else
    PROTOCOL="http"
    API_PORT="80"
fi

SUPABASE_PUBLIC_URL="${PROTOCOL}://${DOMAIN}"
if [ "$DOMAIN" = "localhost" ]; then
    SUPABASE_PUBLIC_URL="http://localhost:54321"
    API_PORT="54321"
fi

API_EXTERNAL_URL="$SUPABASE_PUBLIC_URL"
SITE_URL=$(prompt_with_default "Frontend URL" "${PROTOCOL}://${DOMAIN}")

# Email configuration
echo ""
echo -e "${BLUE}📧 Email Configuration (for authentication):${NC}"
SMTP_HOST=$(prompt_with_default "SMTP Host" "smtp.gmail.com")
SMTP_PORT=$(prompt_with_default "SMTP Port" "587")
SMTP_USER=$(prompt_with_default "SMTP Username" "")
SMTP_PASS=$(prompt_password "SMTP Password")
SMTP_ADMIN_EMAIL=$(prompt_with_default "Admin Email" "$SMTP_USER")
SMTP_SENDER_NAME=$(prompt_with_default "Email Sender Name" "Streamline Scheduler")

# Database configuration
echo ""
echo -e "${BLUE}🗄️  Database Configuration:${NC}"
DB_HOST=$(prompt_with_default "Database Host" "db")
DB_PORT=$(prompt_with_default "Database Port" "5432")
DB_NAME=$(prompt_with_default "Database Name" "postgres")

# Port configuration
echo ""
echo -e "${BLUE}🌐 Port Configuration:${NC}"
KONG_HTTP_PORT=$(prompt_with_default "Kong HTTP Port" "54321")
KONG_HTTPS_PORT=$(prompt_with_default "Kong HTTPS Port" "54323")
STUDIO_PORT=$(prompt_with_default "Supabase Studio Port" "54324")

echo ""
echo -e "${BLUE}📝 Creating .env file...${NC}"

# Create the .env file
cat > .env << EOF
# Streamline Scheduler Production Configuration
# Generated on $(date)

############################################
# 🔒 SECURITY - CHANGE THESE IN PRODUCTION!
############################################

# Database Configuration
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_HOST=$DB_HOST
POSTGRES_PORT=$DB_PORT
POSTGRES_DB=$DB_NAME

# JWT Configuration (CRITICAL: Change in production!)
JWT_SECRET=$JWT_SECRET
JWT_EXPIRY=3600

# Supabase Keys (CRITICAL: Generate new keys for production!)
# Use: supabase gen keys --project-ref YOUR_PROJECT_REF
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY

# Dashboard Access
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=$DASHBOARD_PASSWORD

############################################
# 🌍 URLS AND DOMAINS
############################################

# Public URLs
SUPABASE_PUBLIC_URL=$SUPABASE_PUBLIC_URL
API_EXTERNAL_URL=$API_EXTERNAL_URL
SITE_URL=$SITE_URL
ADDITIONAL_REDIRECT_URLS=

############################################
# 🔌 PORTS
############################################

KONG_HTTP_PORT=$KONG_HTTP_PORT
KONG_HTTPS_PORT=$KONG_HTTPS_PORT
STUDIO_PORT=$STUDIO_PORT

############################################
# 🔐 AUTHENTICATION
############################################

DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false
ENABLE_ANONYMOUS_USERS=false

############################################
# 📧 EMAIL CONFIGURATION
############################################

SMTP_ADMIN_EMAIL=$SMTP_ADMIN_EMAIL
SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS
SMTP_SENDER_NAME=$SMTP_SENDER_NAME

# Email URL Paths
MAILER_URLPATHS_INVITE=/auth/v1/verify
MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify
MAILER_URLPATHS_RECOVERY=/auth/v1/verify
MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify

############################################
# 🗄️  DATABASE SCHEMA
############################################

PGRST_DB_SCHEMAS=public,graphql_public

############################################
# 📊 ANALYTICS
############################################

LOGFLARE_API_KEY=$LOGFLARE_API_KEY

############################################
# ⚡ EDGE FUNCTIONS
############################################

VERIFY_JWT=true

############################################
# 🏢 ORGANIZATION
############################################

STUDIO_DEFAULT_ORGANIZATION=Your Organization
STUDIO_DEFAULT_PROJECT=Streamline Scheduler
OPENAI_API_KEY=
EOF

echo -e "${GREEN}✓ .env file created successfully!${NC}"

# Create frontend .env.local if it doesn't exist
if [ ! -f "frontend/.env.local" ]; then
    echo ""
    echo -e "${BLUE}📝 Creating frontend/.env.local...${NC}"
    
    cat > frontend/.env.local << EOF
# Frontend Environment Variables
# Generated on $(date)

NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_PUBLIC_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
NEXT_PUBLIC_VERCEL_URL=$SITE_URL
EOF
    
    echo -e "${GREEN}✓ frontend/.env.local created successfully!${NC}"
else
    echo -e "${YELLOW}⚠️  frontend/.env.local already exists, skipping...${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Production setup completed!${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Review the generated .env file and customize as needed"
echo "2. For production, generate new Supabase keys using: supabase gen keys"
echo "3. Set up SSL/TLS termination (nginx, Cloudflare, etc.)"
echo "4. Configure your domain's DNS to point to your server"
echo "5. Start the services with: docker compose up -d"
echo ""
echo -e "${BLUE}🔧 Access URLs:${NC}"
echo "• Frontend: $SITE_URL"
echo "• Supabase API: $SUPABASE_PUBLIC_URL"
echo "• Supabase Studio: $SUPABASE_PUBLIC_URL (replace port with $STUDIO_PORT)"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT SECURITY NOTES:${NC}"
echo "• Change default passwords before going live"
echo "• Generate production Supabase keys with 'supabase gen keys'"
echo "• Enable email confirmation in production (ENABLE_EMAIL_AUTOCONFIRM=false)"
echo "• Set up proper backup procedures for your database"
echo "• Consider using managed database services for production"
echo ""
echo -e "${GREEN}✨ Happy deploying!${NC}" 