# Kubernetes Deployment Quick Start

This is a quick reference for deploying Planera to Kubernetes. For detailed information, see [KUBERNETES_DEPLOYMENT.md](./KUBERNETES_DEPLOYMENT.md).

## Prerequisites

- Kubernetes cluster (K3s or similar)
- kubectl configured
- Traefik ingress controller
- cert-manager installed
- GitHub repository secrets configured

## Setup GitHub Secrets

Add to repository settings → Secrets and variables → Actions:

```bash
# KUBECONFIG - base64 encoded kubeconfig
cat ~/.kube/config | base64 -w 0
```

## Update Secrets (Production)

**⚠️ IMPORTANT**: Before deploying to production, update secrets in:

`k8s/production/postgres.yaml`:
```yaml
stringData:
  POSTGRES_PASSWORD: <use-strong-random-password>
  DATABASE_URL: postgresql://planera:<same-password>@postgres:5432/planera_db
  JWT_SECRET: <use-strong-random-jwt-secret-min-32-chars>
```

## Update Domain Names

Update domains in ingress files:

- Staging: `k8s/staging/ingress.yaml`
  - `staging.planera.app` (frontend)
  - `staging-api.planera.app` (backend)

- Production: `k8s/production/ingress.yaml`
  - `app.planera.app` (frontend)
  - `api.planera.app` (backend)

## Configure DNS

Point DNS A records to your cluster ingress IP:

```bash
# Get ingress IP
kubectl get svc -n kube-system traefik
```

## Deploy

### Automatic (Recommended)

**Staging**: Automatically deploys on push to `main`

**Production**: 
1. Go to Actions → "Deploy to Production"
2. Click "Run workflow"
3. Type `deploy-to-production`
4. Click "Run workflow"

### Manual

**Staging**:
```bash
kubectl apply -f k8s/staging/namespace.yaml
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=<username> \
  --docker-password=<token> \
  --namespace=planera-staging
kubectl apply -f k8s/staging/
```

**Production**:
```bash
kubectl apply -f k8s/production/namespace.yaml
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=<username> \
  --docker-password=<token> \
  --namespace=planera-production
kubectl apply -f k8s/production/
```

## Monitor

```bash
# Check pods
kubectl get pods -n planera-staging
kubectl get pods -n planera-production

# Check logs
kubectl logs -f deployment/backend -n planera-staging
kubectl logs -f deployment/frontend -n planera-production

# Check ingress
kubectl get ingress -n planera-staging
kubectl get ingress -n planera-production
```

## Common Commands

```bash
# Restart deployment
kubectl rollout restart deployment/backend -n planera-production

# Scale replicas
kubectl scale deployment/backend --replicas=3 -n planera-production

# Rollback
kubectl rollout undo deployment/backend -n planera-production

# Access database
kubectl port-forward svc/postgres 5432:5432 -n planera-production
```

## Troubleshooting

```bash
# Describe pod
kubectl describe pod <pod-name> -n <namespace>

# Get events
kubectl get events -n <namespace> --sort-by='.lastTimestamp'

# Check certificates
kubectl get certificates -n <namespace>
```

## Environment URLs

- **Staging**: 
  - Frontend: https://staging.planera.app
  - Backend: https://staging-api.planera.app

- **Production**:
  - Frontend: https://app.planera.app
  - Backend: https://api.planera.app

## Workflow

1. **Develop**: Work on feature branch
2. **Test**: Create PR and review
3. **Staging**: Merge to `main` → auto-deploys to staging
4. **Validate**: Test on staging environment
5. **Production**: Manual workflow dispatch to deploy to prod

---

For detailed documentation, troubleshooting, backup strategies, and more, see [KUBERNETES_DEPLOYMENT.md](./KUBERNETES_DEPLOYMENT.md).

