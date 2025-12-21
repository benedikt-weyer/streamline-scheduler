# Complete Infrastructure Setup Summary

This document summarizes all changes made across the three workspaces to implement the new deployment architecture.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     VPS Infrastructure Repo                      │
│                   (streamline-vps)                               │
│  - Sets up k3s Kubernetes cluster                               │
│  - Manages Traefik Ingress Controller                           │
│  - Manages cert-manager                                          │
│  - Infrastructure ONLY - no app deployments                      │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ kubectl context
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                            │
│  ┌──────────────────────┬─────────────────────────────────────┐ │
│  │  Planera App Repo    │    Webpage Repo                     │ │
│  │  (streamline-        │    (streamline-scheduler-webpage)   │ │
│  │   scheduler)         │                                     │ │
│  ├──────────────────────┼─────────────────────────────────────┤ │
│  │ planera-staging      │  planera-webpage-staging            │ │
│  │ - Backend (1 rep)    │  - Webpage (1 rep)                  │ │
│  │ - Frontend (1 rep)   │  - PostgreSQL                       │ │
│  │ - PostgreSQL         │                                     │ │
│  ├──────────────────────┼─────────────────────────────────────┤ │
│  │ planera-production   │  planera-webpage-production         │ │
│  │ - Backend (2 rep)    │  - Webpage (2 rep)                  │ │
│  │ - Frontend (2 rep)   │  - PostgreSQL                       │ │
│  │ - PostgreSQL         │                                     │ │
│  └──────────────────────┴─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Changes by Repository

### 1. streamline-vps (Infrastructure)

**Purpose**: Infrastructure setup ONLY - no application deployments

**Files Changed:**
- ✅ **Deleted**: `k8s/streamline-scheduler.yaml`
- ✅ **Deleted**: `k8s/streamline-scheduler-full.yaml`
- ✅ **Deleted**: `ansible/deploy-app.yml`
- ✅ **Updated**: `README.md` - Comprehensive rewrite

**New Focus:**
- Sets up k3s cluster
- Manages Traefik ingress controller
- Manages cert-manager for SSL
- Provides kubeconfig for applications
- No longer deploys applications directly

**Key Commands:**
```bash
# Setup infrastructure
ansible-playbook -i ansible/inventory/hosts.yml ansible/setup-k3s.yml
ansible-playbook -i ansible/inventory/hosts.yml ansible/deploy-cert-manager.yml
```

---

### 2. streamline-scheduler (Planera App)

**Purpose**: Main Planera application with self-contained deployment

**New Files Created:**

**Kubernetes Manifests:**
```
k8s/
├── staging/
│   ├── namespace.yaml       # planera-staging namespace
│   ├── postgres.yaml        # PostgreSQL + secrets + config
│   ├── backend.yaml         # Backend deployment + service
│   ├── frontend.yaml        # Frontend deployment + service
│   └── ingress.yaml         # Ingress rules for staging
└── production/
    ├── namespace.yaml       # planera-production namespace
    ├── postgres.yaml        # PostgreSQL + secrets + config
    ├── backend.yaml         # Backend deployment (2 replicas)
    ├── frontend.yaml        # Frontend deployment (2 replicas)
    └── ingress.yaml         # Ingress rules for production
```

**CI/CD Workflows:**
```
.github/workflows/
├── deploy-staging.yml       # Auto-deploy on push to main
└── deploy-production.yml    # Manual deploy with confirmation
```

**Helper Scripts:**
- `deploy.sh` - Deployment management CLI
- `setup-k8s-secrets.sh` - Secrets generation and management

**Documentation:**
- `KUBERNETES_DEPLOYMENT.md` - Comprehensive guide (400+ lines)
- `K8S_QUICKSTART.md` - Quick reference
- `GITHUB_ACTIONS_SETUP.md` - CI/CD setup guide
- `CICD_OVERVIEW.md` - Pipeline documentation
- `DEPLOYMENT_SETUP_SUMMARY.md` - Complete overview

**Docker Optimization:**
- `backend/.dockerignore`
- `frontend/.dockerignore`

**Updated:**
- `README.md` - Added Kubernetes deployment section

**Staging Environment:**
- Namespace: `planera-staging`
- Frontend: `staging.planera.app`
- Backend: `staging-api.planera.app`
- Auto-deploys on merge to `main`

**Production Environment:**
- Namespace: `planera-production`
- Frontend: `app.planera.app`
- Backend: `api.planera.app`
- Manual deployment via GitHub Actions

---

### 3. streamline-scheduler-webpage (Webpage/Auth Portal)

**Purpose**: Landing page, authentication, and subscription management

**New Files Created:**

**Kubernetes Manifests:**
```
k8s/
├── staging/
│   ├── namespace.yaml       # planera-webpage-staging namespace
│   ├── postgres.yaml        # PostgreSQL + secrets + config
│   ├── webpage.yaml         # Webpage deployment + service
│   └── ingress.yaml         # Ingress rules for staging
└── production/
    ├── namespace.yaml       # planera-webpage-production namespace
    ├── postgres.yaml        # PostgreSQL + secrets + config
    ├── webpage.yaml         # Webpage deployment (2 replicas)
    └── ingress.yaml         # Ingress rules for production
```

**CI/CD Workflows:**
```
.github/workflows/
├── deploy-staging.yml       # Auto-deploy on push to main
└── deploy-production.yml    # Manual deploy with confirmation
```

**Documentation:**
- `K8S_QUICKSTART.md` - Quick reference guide

**Docker Optimization:**
- `.dockerignore`

**Updated:**
- `README.md` - Added Kubernetes deployment section

**Staging Environment:**
- Namespace: `planera-webpage-staging`
- URL: `staging-www.planera.app`
- Auto-deploys on merge to `main`

**Production Environment:**
- Namespace: `planera-webpage-production`
- URLs: `www.planera.app`, `planera.app`
- Manual deployment via GitHub Actions

---

## Deployment Flow

### Infrastructure Setup (One-time)

```bash
# 1. Setup VPS with k3s cluster
cd streamline-vps
ansible-playbook -i ansible/inventory/hosts.yml ansible/setup-k3s.yml

# 2. Get kubeconfig
ssh user@vps "sudo cat /etc/rancher/k3s/k3s.yaml" | base64 -w 0

# 3. Add KUBECONFIG secret to each app repository
# Repository Settings → Secrets → Add KUBECONFIG
```

### Application Deployments

#### Planera App (streamline-scheduler)

**Staging** (Automatic):
```bash
git checkout main
git pull
# Make changes
git push origin main  # Auto-deploys to staging
```

**Production** (Manual):
1. Go to GitHub Actions
2. Select "Deploy to Production"
3. Type `deploy-to-production`
4. Click "Run workflow"

#### Webpage (streamline-scheduler-webpage)

**Staging** (Automatic):
```bash
git checkout main
git pull
# Make changes
git push origin main  # Auto-deploys to staging
```

**Production** (Manual):
1. Go to GitHub Actions
2. Select "Deploy to Production"
3. Type `deploy-to-production`
4. Click "Run workflow"

---

## Domain Structure

### Planera App
- **Staging**:
  - Frontend: `staging.planera.app`
  - Backend API: `staging-api.planera.app`
- **Production**:
  - Frontend: `app.planera.app`
  - Backend API: `api.planera.app`

### Webpage
- **Staging**:
  - Webpage: `staging-www.planera.app`
- **Production**:
  - Webpage: `www.planera.app`
  - Webpage: `planera.app` (redirect to www)

---

## DNS Configuration

Point all domains to your Kubernetes cluster ingress IP:

```bash
# Get ingress IP
kubectl get svc -n kube-system traefik
```

**DNS Records (A Records):**
```
staging.planera.app           → CLUSTER_IP
staging-api.planera.app       → CLUSTER_IP
app.planera.app               → CLUSTER_IP
api.planera.app               → CLUSTER_IP
staging-www.planera.app       → CLUSTER_IP
www.planera.app               → CLUSTER_IP
planera.app                   → CLUSTER_IP
```

---

## Security Configuration

### Before First Production Deployment

#### Planera App
Update `streamline-scheduler/k8s/production/postgres.yaml`:
```yaml
stringData:
  POSTGRES_PASSWORD: <strong-password>
  JWT_SECRET: <strong-jwt-secret-32-chars>
```

#### Webpage
Update `streamline-scheduler-webpage/k8s/production/postgres.yaml`:
```yaml
stringData:
  POSTGRES_PASSWORD: <strong-password>
  BETTER_AUTH_SECRET: <strong-auth-secret-32-chars>
  STRIPE_SECRET_KEY: sk_live_<production-key>
  STRIPE_WEBHOOK_SECRET: whsec_<production-secret>
```

---

## Key Features

### ✅ Separation of Concerns
- Infrastructure repo manages cluster only
- Each app manages its own deployment
- No cross-repo dependencies

### ✅ Environment Isolation
- Separate staging and production namespaces
- Independent resources and configurations
- Different scaling profiles

### ✅ Automated CI/CD
- Staging: Auto-deploy on merge to main
- Production: Manual approval required
- Zero-downtime rolling updates

### ✅ Security
- TLS certificates via cert-manager
- Kubernetes secrets for sensitive data
- Private container registry (GHCR)
- Namespace isolation

### ✅ Scalability
- Production runs multiple replicas
- Easy horizontal scaling
- Resource limits defined

---

## Quick Commands Reference

### Infrastructure
```bash
# Check cluster
kubectl cluster-info
kubectl get nodes

# Check all namespaces
kubectl get namespaces
kubectl get pods --all-namespaces
```

### Planera App
```bash
# Status
kubectl get pods -n planera-staging
kubectl get pods -n planera-production

# Logs
kubectl logs -f deployment/backend -n planera-production
kubectl logs -f deployment/frontend -n planera-staging

# Restart
kubectl rollout restart deployment/backend -n planera-production
```

### Webpage
```bash
# Status
kubectl get pods -n planera-webpage-staging
kubectl get pods -n planera-webpage-production

# Logs
kubectl logs -f deployment/webpage -n planera-webpage-production

# Migrations
POD=$(kubectl get pod -l app=webpage -n planera-webpage-production -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n planera-webpage-production $POD -- pnpm prisma migrate deploy
```

---

## Next Steps

1. **Setup Infrastructure**
   - Deploy k3s cluster using VPS repo
   - Get kubeconfig
   - Configure DNS

2. **Configure Applications**
   - Add KUBECONFIG secret to GitHub
   - Update production secrets
   - Update domain names if needed

3. **Test Staging**
   - Push to main branch in each repo
   - Verify staging deployments
   - Test functionality

4. **Deploy Production**
   - Use manual workflow dispatch
   - Type confirmation
   - Monitor deployment

5. **Monitor and Maintain**
   - Check pod status regularly
   - Monitor logs
   - Keep dependencies updated

---

## Support and Resources

### Documentation by Repository

**streamline-vps:**
- `README.md` - Infrastructure setup guide

**streamline-scheduler:**
- `KUBERNETES_DEPLOYMENT.md` - Comprehensive deployment guide
- `K8S_QUICKSTART.md` - Quick reference
- `GITHUB_ACTIONS_SETUP.md` - CI/CD setup
- `CICD_OVERVIEW.md` - Pipeline documentation
- `DEPLOYMENT_SETUP_SUMMARY.md` - Complete overview

**streamline-scheduler-webpage:**
- `K8S_QUICKSTART.md` - Quick deployment reference
- `README.md` - Updated with Kubernetes section

### Helper Scripts

**streamline-scheduler:**
- `./deploy.sh` - Deployment operations
- `./setup-k8s-secrets.sh` - Secrets management

---

## Summary

✅ **Infrastructure repo** cleaned up - focuses only on cluster setup
✅ **Planera app** has complete self-contained deployment
✅ **Webpage** has complete self-contained deployment
✅ **Separation of concerns** achieved
✅ **Automated CI/CD** for both apps
✅ **Comprehensive documentation** for all components
✅ **Helper scripts** for easy management
✅ **Production-ready** with security best practices

All three repositories are now properly configured for the new Kubernetes-based deployment architecture with clear separation of concerns!

