# Runtime images

The release bundle builder places the Docker image `.tar` files here before the kit is distributed.

Required:
- `postgres.tar`
- `amis-api.tar`
- `amis-web.tar`
- `dbmate.tar`

Build them on a connected release machine with `scripts/build-offline-bundle.ps1` at the repository root. See `MANIFEST.md`.
