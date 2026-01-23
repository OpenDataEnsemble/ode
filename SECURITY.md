# Security Policy

## Supported Versions

We actively support security updates for the following versions:

| Component | Supported Versions |
|-----------|-------------------|
| synkronus | Latest release and previous major version |
| formulus | Latest release and previous major version |
| formulus-formplayer | Latest release and previous major version |
| synkronus-cli | Latest release and previous major version |
| synkronus-portal | Latest release and previous major version |

Security updates are provided for the latest release and the immediately preceding major version. We recommend keeping all components up to date.

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of the following methods:

1. **Email**: Send details to `security@opendataensemble.org`
2. **GitHub Security Advisory**: Use GitHub's [private vulnerability reporting](https://github.com/opendataensemble/ode/security/advisories/new) feature

### What to Include

When reporting a vulnerability, please include:

- **Description**: A clear description of the vulnerability
- **Component**: Which component(s) are affected (synkronus, formulus, formulus-formplayer, etc.)
- **Severity**: Your assessment of the severity (Critical, High, Medium, Low)
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Impact**: Potential impact of the vulnerability
- **Suggested Fix**: If you have ideas for how to fix it (optional but appreciated)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your report within 48 hours
- **Initial Assessment**: We will provide an initial assessment within 7 days
- **Updates**: We will keep you informed of our progress
- **Resolution**: We will work to resolve critical vulnerabilities as quickly as possible
- **Credit**: With your permission, we will credit you in security advisories

### Disclosure Policy

- We follow **responsible disclosure** practices
- We will work with you to coordinate public disclosure after a fix is available
- We aim to provide fixes within 90 days for critical vulnerabilities
- Public disclosure will be made through GitHub Security Advisories

## Security Best Practices

### Authentication & Authorization

#### JWT Token Security

- **Strong Secrets**: Always use strong, randomly generated JWT secrets
  ```bash
  openssl rand -base64 32
  ```
- **Token Expiration**: Tokens expire after 24 hours by default
- **Refresh Tokens**: Refresh tokens expire after 7 days
- **HTTPS Only**: Always use HTTPS in production to protect tokens in transit
- **Secure Storage**: Store tokens securely on clients (e.g., React Native Keychain)

#### Role-Based Access Control

- **Roles**: The system supports `admin`, `read-write`, and `read-only` roles
- **Principle of Least Privilege**: Grant users only the minimum permissions they need
- **Default Admin**: Change the default admin password immediately after deployment

#### Password Security

- **Strong Passwords**: Use strong, unique passwords for all accounts
- **Password Hashing**: Passwords are hashed using bcrypt
- **No Default Passwords**: Never use default passwords in production

### Data Protection

#### Encryption in Transit

- **HTTPS/TLS**: All API communications must use HTTPS
- **TLS Configuration**: Use TLS 1.2 or higher
- **Certificate Management**: Use Let's Encrypt or similar for automatic certificate management
- **Reverse Proxy**: Use nginx or similar reverse proxy for TLS termination

#### Encryption at Rest

- **Database Encryption**: PostgreSQL encryption at rest depends on the underlying storage layer
- **File Storage**: Attachments are stored on the filesystem; consider encrypting the filesystem
- **Backup Encryption**: Encrypt database backups before storing them

#### Data Privacy

- **Local-First**: The Formulus mobile app stores data locally and only syncs to user-configured servers
- **No Third-Party Data Collection**: Formulus does not collect or transmit data to third parties
- **User Control**: Users control their own sync endpoints and data

### File Upload Security

#### Attachment Handling

- **Path Traversal Protection**: Attachment IDs are validated to prevent directory traversal attacks
- **File Size Limits**: Multipart form parsing is limited to 32MB by default
- **Immutable Attachments**: Once uploaded, attachments cannot be modified (new uploads create new files)
- **Authentication Required**: All attachment endpoints require authentication
- **File Type Validation**: Consider implementing file type validation (currently not enforced)

#### Recommendations

- **Malware Scanning**: Consider implementing malware scanning for uploaded files
- **File Type Restrictions**: Validate file types and MIME types on upload
- **Size Limits**: Configure appropriate size limits based on your use case
- **Storage Quotas**: Implement storage quotas per user or organization

### Configuration Security

#### Environment Variables

- **Secrets Management**: Never commit secrets to version control
- **Environment Files**: `.env` files are excluded from git (see `.gitignore`)
- **Production Secrets**: Use secure secret management systems in production (e.g., Docker secrets, Kubernetes secrets, AWS Secrets Manager)
- **Rotation**: Regularly rotate secrets, especially JWT secrets

#### Required Secrets

The following secrets must be configured securely:

- `JWT_SECRET`: Secret key for JWT token signing (generate with `openssl rand -base64 32`)
- `DB_CONNECTION`: PostgreSQL connection string (includes password)
- `ADMIN_PASSWORD`: Initial admin password (change after first login)
- Android signing keys: Keystore files and passwords (stored securely, never committed)

#### Default Values

- **Never use defaults in production**: Default values are for development only
- **Change admin credentials**: Always change default admin username and password
- **Generate strong secrets**: Use cryptographically secure random generators

### Deployment Security

#### Docker Security

- **Image Sources**: Use official images from trusted sources (ghcr.io, Docker Hub official images)
- **Image Scanning**: Scan Docker images for vulnerabilities
- **Non-Root Users**: Containers run as non-root users where possible
- **Minimal Images**: Use minimal base images (Alpine Linux) to reduce attack surface
- **Secrets Management**: Use Docker secrets or environment variables for sensitive data

#### Network Security

- **Firewall Configuration**: Configure firewalls to allow only necessary ports
  ```bash
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw enable
  ```
- **Internal Networks**: Use Docker internal networks for service communication
- **Reverse Proxy**: Use nginx or similar reverse proxy for TLS termination and rate limiting
- **Cloudflare Tunnel**: Consider using Cloudflare Tunnel for secure, zero-trust access

#### Database Security

- **Connection Security**: Use SSL/TLS for database connections in production
- **Strong Passwords**: Use strong, unique passwords for database users
- **Access Control**: Limit database access to only necessary services
- **Backup Security**: Encrypt and securely store database backups
- **Regular Updates**: Keep PostgreSQL updated with security patches

#### CI/CD Security

- **Secrets Management**: Use GitHub Secrets for sensitive CI/CD data
- **Build Attestation**: Build provenance is generated for Docker images
- **Dependency Scanning**: Regularly update dependencies and scan for vulnerabilities
- **Signed Builds**: Android APKs are signed with release keys (stored securely)

### Mobile App Security (Formulus)

#### Android Security

- **APK Signing**: Release builds are signed with secure keystores
- **Keystore Protection**: Keystore files and passwords are stored securely and never committed
- **ProGuard/R8**: Code obfuscation and minification for release builds
- **Permissions**: Request only necessary permissions

#### iOS Security

- **Code Signing**: Apps are signed with Apple certificates
- **Keychain Storage**: Sensitive data (tokens) stored in iOS Keychain
- **App Transport Security**: Enforces HTTPS connections

#### Data Storage

- **Local Storage**: Data stored locally using secure storage mechanisms
- **Token Storage**: Authentication tokens stored in secure keychain/keystore
- **Offline-First**: App works offline; data syncs only to user-configured servers

### API Security

#### Input Validation

- **Schema Validation**: All API inputs are validated against OpenAPI schemas
- **SQL Injection Prevention**: Use parameterized queries (handled by Go database drivers)
- **Path Traversal**: Attachment paths are validated and sanitized
- **Size Limits**: Request size limits are enforced

#### Rate Limiting

- **Recommendation**: Implement rate limiting at the reverse proxy level (nginx)
- **Authentication Endpoints**: Consider stricter rate limiting for login endpoints
- **API Endpoints**: Implement rate limiting to prevent abuse

#### CORS Configuration

- **Origin Validation**: Configure CORS appropriately for web clients
- **Credentials**: Handle credentials securely in CORS configuration

### Dependency Security

#### Regular Updates

- **Dependency Scanning**: Regularly scan dependencies for known vulnerabilities
- **Automated Updates**: Use tools like Dependabot or Renovate for automated updates
- **Security Advisories**: Monitor security advisories for all dependencies

#### Known Vulnerabilities

- **Reporting**: Report dependency vulnerabilities through the same process as code vulnerabilities
- **Patching**: Critical dependency vulnerabilities are patched as quickly as possible

### Logging & Monitoring

#### Security Logging

- **Authentication Events**: Log authentication successes and failures
- **Authorization Failures**: Log authorization failures
- **Suspicious Activity**: Monitor for suspicious patterns
- **Error Handling**: Avoid logging sensitive information (passwords, tokens, etc.)

#### Log Security

- **Sensitive Data**: Never log passwords, tokens, or other sensitive data
- **Log Retention**: Implement appropriate log retention policies
- **Log Access**: Restrict access to logs containing sensitive information

## Security Checklist for Deployment

Before deploying to production, ensure:

- [ ] All default passwords have been changed
- [ ] Strong JWT secret has been generated and configured
- [ ] HTTPS/TLS is enabled and properly configured
- [ ] Database connection uses SSL/TLS
- [ ] Firewall is configured appropriately
- [ ] Secrets are stored securely (not in version control)
- [ ] Regular backups are configured and tested
- [ ] Monitoring and logging are configured
- [ ] Dependencies are up to date
- [ ] Security updates are applied to the operating system
- [ ] Reverse proxy is configured with rate limiting
- [ ] File upload limits are configured appropriately
- [ ] Admin account password has been changed from default

## Security Updates

### How We Handle Security Updates

- **Critical Vulnerabilities**: Patched within 7 days when possible
- **High Severity**: Patched within 30 days
- **Medium Severity**: Patched within 90 days
- **Low Severity**: Addressed in regular release cycles

### Staying Informed

- **GitHub Security Advisories**: Subscribe to GitHub Security Advisories for this repository
- **Release Notes**: Check release notes for security-related updates
- **Changelog**: Review changelogs for security fixes

## Security Research

We appreciate security research that helps make ODE more secure. If you're conducting security research:

1. **Follow Responsible Disclosure**: Report vulnerabilities through our reporting process
2. **Do Not Exploit**: Do not exploit vulnerabilities beyond what's necessary to demonstrate them
3. **Respect Privacy**: Do not access or modify user data without permission
4. **Stay in Scope**: Focus on the ODE codebase and infrastructure

## Contact

For security-related questions or concerns:

- **Security Email**: `security@opendataensemble.org`
- **General Contact**: `hello@sapiens-solutions.com`
- **Website**: https://opendataensemble.org

## Acknowledgments

We thank all security researchers and contributors who help keep ODE secure. Security researchers who responsibly disclose vulnerabilities will be credited (with permission) in security advisories.

---

**Last Updated**: 2025-01-14

**Note**: This security policy is a living document and will be updated as the project evolves. Please check back periodically for updates.

