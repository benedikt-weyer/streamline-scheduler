#!/bin/bash
# Deployment helper script for Plandera Kubernetes deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
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

# Check if kubectl is installed
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed. Please install it first."
        exit 1
    fi
    print_success "kubectl is installed"
}

# Check cluster connection
check_cluster() {
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
        exit 1
    fi
    print_success "Connected to Kubernetes cluster"
}

# Deploy to staging
deploy_staging() {
    print_info "Deploying to staging environment..."
    
    kubectl apply -f k8s/staging/namespace.yaml
    kubectl apply -f k8s/staging/postgres.yaml
    kubectl apply -f k8s/staging/backend.yaml
    kubectl apply -f k8s/staging/frontend.yaml
    kubectl apply -f k8s/staging/ingress.yaml
    
    print_info "Waiting for deployments to be ready..."
    kubectl rollout status deployment/backend -n plandera-staging --timeout=5m || true
    kubectl rollout status deployment/frontend -n plandera-staging --timeout=5m || true
    
    print_success "Staging deployment complete!"
    print_info "View status with: kubectl get pods -n plandera-staging"
}

# Deploy to production
deploy_production() {
    print_warning "You are about to deploy to PRODUCTION!"
    read -p "Type 'yes' to confirm: " confirm
    
    if [ "$confirm" != "yes" ]; then
        print_error "Deployment cancelled"
        exit 1
    fi
    
    print_info "Deploying to production environment..."
    
    kubectl apply -f k8s/production/namespace.yaml
    kubectl apply -f k8s/production/postgres.yaml
    kubectl apply -f k8s/production/backend.yaml
    kubectl apply -f k8s/production/frontend.yaml
    kubectl apply -f k8s/production/ingress.yaml
    
    print_info "Waiting for deployments to be ready..."
    kubectl rollout status deployment/backend -n plandera-production --timeout=5m || true
    kubectl rollout status deployment/frontend -n plandera-production --timeout=5m || true
    
    print_success "Production deployment complete!"
    print_info "View status with: kubectl get pods -n plandera-production"
}

# Status check
check_status() {
    local env=$1
    local namespace="plandera-${env}"
    
    print_info "Status for ${env} environment:"
    echo ""
    
    print_info "Pods:"
    kubectl get pods -n "$namespace"
    echo ""
    
    print_info "Services:"
    kubectl get svc -n "$namespace"
    echo ""
    
    print_info "Ingress:"
    kubectl get ingress -n "$namespace"
}

# View logs
view_logs() {
    local env=$1
    local component=$2
    local namespace="plandera-${env}"
    
    if [ -z "$component" ]; then
        print_error "Please specify component: backend or frontend"
        exit 1
    fi
    
    print_info "Viewing logs for ${component} in ${env}..."
    kubectl logs -f deployment/"$component" -n "$namespace"
}

# Rollback deployment
rollback_deployment() {
    local env=$1
    local component=$2
    local namespace="plandera-${env}"
    
    if [ -z "$component" ]; then
        print_error "Please specify component: backend or frontend"
        exit 1
    fi
    
    print_warning "Rolling back ${component} in ${env}..."
    kubectl rollout undo deployment/"$component" -n "$namespace"
    kubectl rollout status deployment/"$component" -n "$namespace"
    print_success "Rollback complete!"
}

# Restart deployment
restart_deployment() {
    local env=$1
    local component=$2
    local namespace="plandera-${env}"
    
    if [ -z "$component" ]; then
        print_error "Please specify component: backend or frontend"
        exit 1
    fi
    
    print_info "Restarting ${component} in ${env}..."
    kubectl rollout restart deployment/"$component" -n "$namespace"
    kubectl rollout status deployment/"$component" -n "$namespace"
    print_success "Restart complete!"
}

# Show help
show_help() {
    echo "Plandera Kubernetes Deployment Helper"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  deploy staging              Deploy to staging environment"
    echo "  deploy production           Deploy to production environment"
    echo "  status staging|production   Show deployment status"
    echo "  logs staging|production backend|frontend"
    echo "                              View logs for a component"
    echo "  rollback staging|production backend|frontend"
    echo "                              Rollback a deployment"
    echo "  restart staging|production backend|frontend"
    echo "                              Restart a deployment"
    echo "  check                       Check prerequisites"
    echo ""
    echo "Examples:"
    echo "  $0 deploy staging"
    echo "  $0 status production"
    echo "  $0 logs staging backend"
    echo "  $0 rollback production backend"
    echo "  $0 restart staging frontend"
}

# Main script
main() {
    case "${1}" in
        deploy)
            check_kubectl
            check_cluster
            case "${2}" in
                staging)
                    deploy_staging
                    ;;
                production)
                    deploy_production
                    ;;
                *)
                    print_error "Invalid environment. Use 'staging' or 'production'"
                    exit 1
                    ;;
            esac
            ;;
        status)
            check_kubectl
            check_cluster
            case "${2}" in
                staging|production)
                    check_status "${2}"
                    ;;
                *)
                    print_error "Invalid environment. Use 'staging' or 'production'"
                    exit 1
                    ;;
            esac
            ;;
        logs)
            check_kubectl
            check_cluster
            view_logs "${2}" "${3}"
            ;;
        rollback)
            check_kubectl
            check_cluster
            rollback_deployment "${2}" "${3}"
            ;;
        restart)
            check_kubectl
            check_cluster
            restart_deployment "${2}" "${3}"
            ;;
        check)
            check_kubectl
            check_cluster
            print_success "All prerequisites met!"
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

