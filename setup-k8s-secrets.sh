#!/bin/bash
# Script to help set up Kubernetes secrets for Plandera deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Generate random password
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Generate JWT secret
generate_jwt_secret() {
    openssl rand -base64 48 | tr -d "=+/" | cut -c1-48
}

# Create secrets for staging
create_staging_secrets() {
    local postgres_password="${1:-$(generate_password)}"
    local jwt_secret="${2:-$(generate_jwt_secret)}"
    
    print_info "Creating staging secrets..."
    
    # Backup existing secrets file
    if [ -f "k8s/staging/postgres.yaml" ]; then
        cp k8s/staging/postgres.yaml k8s/staging/postgres.yaml.backup
        print_info "Backed up existing postgres.yaml to postgres.yaml.backup"
    fi
    
    # Update secrets in the file
    sed -i "s/POSTGRES_PASSWORD: changeme-staging/POSTGRES_PASSWORD: ${postgres_password}/" k8s/staging/postgres.yaml
    sed -i "s/changeme-staging/${postgres_password}/g" k8s/staging/postgres.yaml
    sed -i "s/JWT_SECRET: changeme-staging-jwt-secret-at-least-32-chars/JWT_SECRET: ${jwt_secret}/" k8s/staging/postgres.yaml
    
    print_success "Staging secrets updated!"
    print_info "PostgreSQL Password: ${postgres_password}"
    print_info "JWT Secret: ${jwt_secret}"
    echo ""
    print_warning "Save these credentials securely!"
}

# Create secrets for production
create_production_secrets() {
    local postgres_password="${1:-$(generate_password)}"
    local jwt_secret="${2:-$(generate_jwt_secret)}"
    
    print_info "Creating production secrets..."
    
    # Backup existing secrets file
    if [ -f "k8s/production/postgres.yaml" ]; then
        cp k8s/production/postgres.yaml k8s/production/postgres.yaml.backup
        print_info "Backed up existing postgres.yaml to postgres.yaml.backup"
    fi
    
    # Update secrets in the file
    sed -i "s/POSTGRES_PASSWORD: changeme-production-REPLACE-WITH-STRONG-PASSWORD/POSTGRES_PASSWORD: ${postgres_password}/" k8s/production/postgres.yaml
    sed -i "s/changeme-production-REPLACE-WITH-STRONG-PASSWORD/${postgres_password}/g" k8s/production/postgres.yaml
    sed -i "s/JWT_SECRET: changeme-production-jwt-secret-REPLACE-WITH-STRONG-SECRET-at-least-32-chars/JWT_SECRET: ${jwt_secret}/" k8s/production/postgres.yaml
    
    print_success "Production secrets updated!"
    print_info "PostgreSQL Password: ${postgres_password}"
    print_info "JWT Secret: ${jwt_secret}"
    echo ""
    print_warning "Save these credentials securely!"
}

# Create GitHub image pull secret
create_image_pull_secret() {
    local env=$1
    local namespace="plandera-${env}"
    local github_username=$2
    local github_token=$3
    
    if [ -z "$github_username" ] || [ -z "$github_token" ]; then
        print_error "GitHub username and token are required"
        return 1
    fi
    
    print_info "Creating image pull secret in ${namespace}..."
    
    kubectl create namespace "$namespace" --dry-run=client -o yaml | kubectl apply -f -
    
    kubectl create secret docker-registry ghcr-secret \
        --docker-server=ghcr.io \
        --docker-username="$github_username" \
        --docker-password="$github_token" \
        --namespace="$namespace" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    print_success "Image pull secret created for ${env}!"
}

# Show help
show_help() {
    echo "Plandera Kubernetes Secrets Setup Helper"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  secrets staging             Generate and update staging secrets"
    echo "  secrets production          Generate and update production secrets"
    echo "  image-pull staging <github-username> <github-token>"
    echo "                              Create image pull secret for staging"
    echo "  image-pull production <github-username> <github-token>"
    echo "                              Create image pull secret for production"
    echo "  all staging <github-username> <github-token>"
    echo "                              Setup all secrets for staging"
    echo "  all production <github-username> <github-token>"
    echo "                              Setup all secrets for production"
    echo ""
    echo "Examples:"
    echo "  $0 secrets staging"
    echo "  $0 image-pull production myusername ghp_xxxxxxxxxxxx"
    echo "  $0 all staging myusername ghp_xxxxxxxxxxxx"
    echo ""
    echo "Note: Generated secrets will be printed. Save them securely!"
}

# Main script
main() {
    case "${1}" in
        secrets)
            case "${2}" in
                staging)
                    create_staging_secrets
                    ;;
                production)
                    create_production_secrets
                    ;;
                *)
                    print_error "Invalid environment. Use 'staging' or 'production'"
                    exit 1
                    ;;
            esac
            ;;
        image-pull)
            case "${2}" in
                staging|production)
                    create_image_pull_secret "${2}" "${3}" "${4}"
                    ;;
                *)
                    print_error "Invalid environment. Use 'staging' or 'production'"
                    exit 1
                    ;;
            esac
            ;;
        all)
            case "${2}" in
                staging)
                    create_staging_secrets
                    echo ""
                    create_image_pull_secret staging "${3}" "${4}"
                    ;;
                production)
                    create_production_secrets
                    echo ""
                    create_image_pull_secret production "${3}" "${4}"
                    ;;
                *)
                    print_error "Invalid environment. Use 'staging' or 'production'"
                    exit 1
                    ;;
            esac
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            show_help
            exit 1
            ;;
    esac
}

main "$@"

