# Contributing

Use Node.js 20 or newer. Run `npm test` and both CLI examples before proposing a change. The repository has no runtime dependencies and requires no account or provider API key.

Keep validation separate from rendering. Do not add implicit uploads, paid requests, analytics, or provider-specific limits to the offline core. Declare capabilities in configuration and document assumptions.

For a provider adapter, propose its schema and offline fixtures first. Use fictitious references rather than customer media, keys, signed URLs, or production responses. Scene documentation must describe observable behavior and distinguish the hosted service from this toolkit.

For errors, open an issue with the tool version, Node.js version, a minimal synthetic configuration, expected behavior, and actual error. Remove private paths and all credentials before posting.

Keep contributions focused, include meaningful tests for behavior changes, and retain the license notice. Do not upload third-party media without permission.
