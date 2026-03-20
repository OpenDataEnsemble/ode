# Synkronus

**Synkronus** is a lightweight, offline-first sync API designed to support the `Collective` app ecosystem. It enables reliable synchronization of structured form data, app bundles, and file attachments in constrained environments. Built with modularity, performance, and FLOSS values in mind.

---

## 🚀 Project Goals

- **Offline-first**: Built to work in unreliable or offline environments
- **Modular**: Clean API for syncing data, files, and custom app bundles
- **FLOSS**: Fully open source stack, self-hostable and auditable
- **Lean & fast**: Minimal runtime dependencies, Docker-friendly
- **Custom sync protocol**: Avoids the complexity and rigidity of CouchDB replication
- **Security**: JWT-based authentication with simple role-based access

---

## 🔐 API Summary

- `/app-bundle/manifest` — get current app bundle version
- `/sync/pull` & `/sync/push` — record synchronization
- `/attachments/manifest` & `/attachments/:id` — sync binary files
- `/formspecs/{schemaType}/{schemaVersion}` — get form schemas
- JWT-based auth with `read-only` and `read-write` roles
- Optional API versioning via `x-api-version` header
- Optional ETag support for caching and efficiency

Full OpenAPI spec lives in [`synkronus/openapi/synkronus.yaml`](../openapi/synkronus.yaml)

---

## 🔄 Coming Soon

- Admin API (formspec publishing, user management, etc.)
- Partial pull queries and conflict resolution strategies
- Integration with JSONForms registry
- CI/CD GitHub Actions pipeline
- Observability pipeline via Fluent Bit or Vector

---

## 📖 License

MIT — open source, commercial use permitted, no copyleft. We love contributions!

