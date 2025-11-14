# ODE CI/CD Quick Reference

Quick reference for common CI/CD operations in the Open Data Ensemble monorepo.

## 🚀 Synkronus Docker Images

### Pull Images

```bash
# Latest stable release
docker pull ghcr.io/opendataensemble/synkronus:latest

# Specific version
docker pull ghcr.io/opendataensemble/synkronus:v1.0.0

# Development version
docker pull ghcr.io/opendataensemble/synkronus:develop

# Feature branch
docker pull ghcr.io/opendataensemble/synkronus:feature-name
```

### Run Image

```bash
docker run -d \
  --name synkronus \
  -p 8080:8080 \
  -e DB_CONNECTION="postgres://user:pass@host:5432/synkronus" \
  -e JWT_SECRET="your-secret-key" \
  -v synkronus-bundles:/app/data/app-bundles \
  ghcr.io/opendataensemble/synkronus:latest
```

### Available Tags

| Tag | Description | Use Case |
|-----|-------------|----------|
| `latest` | Latest from main | Production |
| `v1.0.0` | Specific version | Production (pinned) |
| `develop` | Development branch | Staging |
| `feature-xyz` | Feature branch | Testing |
| `main-abc123` | Specific commit | Debugging |

## 🔄 Triggering Builds

### Automatic Triggers

Builds trigger automatically when:
- Pushing to `main`, `develop`, or feature branches
- Creating pull requests
- Only when files in `synkronus/` change

### Manual Trigger

1. Go to **Actions** → **Synkronus Docker Build & Publish**
2. Click **Run workflow**
3. Select branch
4. (Optional) Enter version tag
5. Click **Run workflow**

## 📦 Creating Releases

### Quick Release (Latest)
```bash
git checkout main
git tag v1.0.0
git push origin main
# Workflow automatically creates 'latest' tag
```

### Versioned Release
1. Actions → Synkronus Docker Build & Publish → Run workflow
2. Branch: `main`
3. Version: `v1.0.0`
4. Run workflow

Creates:
- `latest`
- `v1.0.0`
- `v1.0`

## 🔍 Monitoring

### View Workflow Runs
```
GitHub → Actions → Synkronus Docker Build & Publish
```

### View Published Images
```
GitHub → Packages → synkronus
```

### Check Build Status
```bash
# View workflow status
gh run list --workflow=synkronus-docker.yml

# View specific run
gh run view <run-id>
```

## 🐛 Troubleshooting

### Build Failed

```bash
# View logs
gh run view <run-id> --log

# Test locally
cd synkronus
docker build -t test .
```

### Image Not Found

```bash
# List available tags
gh api /orgs/opendataensemble/packages/container/synkronus/versions

# Or check GitHub Packages UI
```

### Cannot Pull Image

```bash
# For private repos, authenticate
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Verify image exists
docker manifest inspect ghcr.io/opendataensemble/synkronus:latest
```

## 🔐 Authentication

### GitHub CLI
```bash
gh auth login
```

### Docker Login
```bash
# Using personal access token
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Using GitHub CLI
gh auth token | docker login ghcr.io -u USERNAME --password-stdin
```

## 📊 Image Information

### View Image Details
```bash
# Inspect image
docker inspect ghcr.io/opendataensemble/synkronus:latest

# View image history
docker history ghcr.io/opendataensemble/synkronus:latest

# Check image size
docker images ghcr.io/opendataensemble/synkronus
```

### View Image Layers
```bash
# Using dive (install: https://github.com/wagoodman/dive)
dive ghcr.io/opendataensemble/synkronus:latest
```

## 🚢 Deployment

### Coolify

1. Create new service → Docker Image
2. Image: `ghcr.io/opendataensemble/synkronus:latest`
3. Configure environment variables
4. Add volume: `/app/data/app-bundles`
5. Deploy

### Docker Compose

```bash
# Use pre-built image
docker-compose up -d

# Force pull latest
docker-compose pull
docker-compose up -d
```

### Kubernetes (Future)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: synkronus
spec:
  template:
    spec:
      containers:
      - name: synkronus
        image: ghcr.io/opendataensemble/synkronus:latest
```

## 🔄 Rollback

### Quick Rollback
```bash
# Stop current
docker stop synkronus && docker rm synkronus

# Run previous version
docker run -d [same options] ghcr.io/opendataensemble/synkronus:v1.0.0
```

### Coolify Rollback
1. Go to deployment history
2. Select previous version
3. Click "Redeploy"

## 📝 Best Practices

### Production
- ✅ Pin specific versions: `v1.0.0`
- ✅ Test in staging first
- ✅ Keep rollback plan ready
- ❌ Don't use `latest` in production

### Development
- ✅ Use `develop` for staging
- ✅ Use feature branches for testing
- ✅ Test locally before pushing
- ✅ Clean up old images regularly

### CI/CD
- ✅ Monitor build times
- ✅ Review build logs
- ✅ Keep workflows updated
- ✅ Document changes

## 🔗 Quick Links

- [Full CI/CD Documentation](CICD.md)
- [Synkronus Docker Guide](../synkronus/DOCKER.md)
- [Synkronus Deployment Guide](../synkronus/DEPLOYMENT.md)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [GHCR Docs](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)

## 💡 Tips

### Speed Up Local Development
```bash
# Use local cache
docker pull ghcr.io/opendataensemble/synkronus:latest
docker tag ghcr.io/opendataensemble/synkronus:latest synkronus:local
```

### Clean Up Old Images
```bash
# Remove unused images
docker image prune -a

# Remove specific tag
docker rmi ghcr.io/opendataensemble/synkronus:old-tag
```

### View Real-time Logs
```bash
# Follow workflow logs
gh run watch

# Follow container logs
docker logs -f synkronus
```
