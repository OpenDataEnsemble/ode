# Attachment push UX (discovery)

Implementation of uploading attachment blobs when pushing observations is **deferred** until product decisions are recorded here.

## Questions to resolve

1. **Surface** — Where users add or pick files (Observations editor only, Import, a dedicated step before Sync, or a combination).
2. **Identifiers** — How local `attachment_id` values are chosen so they match server rules and observation `data` references (client-generated UUIDs vs server-assigned).
3. **Ordering and atomicity** — Whether uploads must complete before the observation push, how to handle partial failures, and what the user can retry without duplicating data.
4. **Messaging** — User-visible copy on the Sync page and for HTTP or storage errors during upload.

## Outcome

When the above are decided, append a short **Decision** subsection and link it from the project plan; then implement upload using the Synkronus attachment APIs and the workspace `attachments/` layout.
