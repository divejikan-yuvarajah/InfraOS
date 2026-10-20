# Step 23 review

- Base `development` includes Step 22 (`d8bc964` lineage; feedback components present).
- Branch `feature/step-23-responsive-app-shell`.
- Public `/` is not wrapped in `AppShell`. Dev fixture embeds the shell.
- Live nav href: `/` only. Future items have no href.
- Viewport keyboard QA: NOT RUN in this pass.
- Review fix: shell content uses `role="region"` (not nested `<main>`) when embedded on `/`; page title uses `<h2>` inside shell to avoid duplicate `<h1>`.
