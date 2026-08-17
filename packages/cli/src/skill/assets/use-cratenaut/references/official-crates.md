# Official Crates

Install only the packages required by the project

## Caddy

Package: `@cratenaut/caddy`

Use for structured HTTP responses, redirects, reverse proxies, automatic or internal TLS, or advanced raw Caddyfile and JSON configuration

Default ports publish HTTP, HTTPS, and HTTP/3. For local examples, explicitly use an unprivileged port and disable HTTPS and HTTP/3

Raw configuration and custom images have unknown risk. Structured configuration can be validated and reloaded

## Gitea

Package: `@cratenaut/gitea`

Requires `publicUrl`. Defaults to SQLite, closed registration, and no published HTTP or SSH ports

When using Caddy on the same server, keep `http: false` and proxy to `<gitea-instance>-server:3000`

Database type is immutable. Migrating SQLite, PostgreSQL, or MySQL requires an explicit data migration

Treat `security.secretKey` and `security.internalToken` as immutable secrets

## PostgreSQL

Package: `@cratenaut/postgres`

Requires `password`. Defaults to no published host port. Other containers use `<instance>-server:5432`

Username, password, database, and initialization options apply only to an empty data directory and are immutable configuration. Password rotation requires `ALTER ROLE` and coordinated application updates

Changing official PostgreSQL image major versions is destructive and requires a real database upgrade process

## Redis

Package: `@cratenaut/redis`

All options are optional. Defaults to RDB persistence and no published host port

Publishing a host port requires a password. Prefer a loopback address when only local access is needed

Persistence can be RDB, AOF, both, or disabled. Disabling persistence for an existing persistent instance is destructive
