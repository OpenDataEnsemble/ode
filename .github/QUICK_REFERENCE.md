# ODE CI/CD Quick Reference

Quick reference for common CI/CD operations in the Open Data Ensemble monorepo.

## 🚀 Synkronus Docker Images

### Pull Images

```bash
# Latest stable release
docker pull ghcr.io/opendataensemble/synkronus:latest

# Latest published pre-release
docker pull ghcr.io/opendataensemble/synkronus:latest-pre-release

# Specific stable or pre-release version
docker pull ghcr.io/opendataensemble/synkronus:v1.2.3
docker pull ghcr.io/opendataensemble/synkronus:v1.2.3-alpha.4

# Development branch tip
docker pull ghcr.io/opendataensemble/synkronus:dev

# Main branch tip
docker pull ghcr.io/opendataensemble/synkronus:main
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

| Tag | What it tracks | Recommended use |
|-----|----------------|-----------------|
| `latest` | Most recently published stable release | Auto-updating production |
| `latest-pre-release` | Most recently published pre-release | Auto-updating demo/staging, including Watchtower |
| `dev` | Tip of the `dev` branch | Bleeding-edge integration testing |
| `main` | Tip of the `main` branch | Testing current main between releases |
| `v1.2.3-alpha.4` | One specific pre-release | Pinned pre-release deployment |
| `v1.2.3` | One specific stable release | Pinned production deployment |
| `sha-abc1234` | One specific commit | Debugging and exact reproduction |

`dev` is not the pre-release channel. Release pointer tags move only when a GitHub Release is published; `latest-pre-release` requires the release to be marked as a pre-release.

## 🔄 Triggering Builds

### Automatic Triggers

Builds trigger automatically when:
- Pushing relevant changes to `main` or `dev`
- Creating pull requests with relevant changes (build only; no image is published)
- Publishing a stable or pre-release GitHub Release

Relevant paths include `synkronus/`, `synkronus-portal/`, shared `packages/`, the Dockerfiles, and the workflow itself.

### Manual Trigger

1. Go to **Actions** → **Synkronus & Portal Docker Build & Publish**
2. Click **Run workflow**
3. Select the branch or commit
4. Click **Run workflow**

Manual runs publish only an immutable `sha-{short}` tag; they do not move `latest`, `latest-pre-release`, `main`, or `dev`.

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
- ✅ Use `latest-pre-release` for staging published releases
- ✅ Use `dev` only for bleeding-edge branch testing
- ✅ Use manually dispatched `sha-{short}` images for exact feature-branch testing
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
