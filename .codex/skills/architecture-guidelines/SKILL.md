---
name: architecture-guidelines
description: Apply the Easy Clip NestJS Clean Architecture, feature-domain boundaries, layer placement, testing rules, and Prisma conventions. Use when adding, modifying, refactoring, or reviewing files under src, test, or prisma, and when deciding where APIs, use cases, DTOs, repositories, shared authentication contracts, schemas, or configuration belong.
---

# Easy Clip Architecture Guidelines

## Workflow

1. Identify the affected feature domains and endpoints.
2. Classify every changed element as presentation, application, domain, infrastructure, or shared code.
3. Check that no feature domain imports another feature domain's internal layers.
4. Keep one use case per endpoint and implement business flow in the use case.
5. Add or update use-case tests and run validation appropriate to the change.

## Current Project Structure

- Keep application code in `src/`.
- Use `src/main.ts` as the entry point and `src/app.module.ts` as the root module.
- Keep end-to-end tests and the Jest E2E configuration in `test/`.
- Keep the Prisma schema and migrations in `prisma/`.
- Treat `dist/` as generated output from `pnpm build`; never edit it directly.
- Use `src/prisma` for the shared Prisma module and service.
- Use `src/shared` for cross-feature contracts, helpers, guards, filters, ports, and external adapters.
- Use `src/types` only for project-wide ambient TypeScript declarations.

The current feature domains are `auth`, `clips`, `folders`, `users`, `subscriptions`, `trash`, and `workspaces`. The `workspaces` domain currently contains only its module shell; preserve the same architecture when expanding it.

## Feature-Domain Layout

Apply this layout to every feature domain:

```text
<feature-domain>/
├── presentation/
├── application/
├── domain/
└── infrastructure/
```

- `presentation`: Handle request and response concerns such as controllers, guards, strategies, and HTTP DTOs.
- `application`: Keep use cases, use-case input/output DTOs, ports, application errors, and use-case-specific models.
- `domain`: Keep entities, repository interfaces, and types that express business concepts.
- `infrastructure`: Implement internal contracts with Prisma or external service adapters.

Maintain the dependency direction `Presentation → Application → Domain`. Infrastructure implements contracts owned by inner layers and is wired at module composition points.

## Terminology

- Call business units such as `auth`, `clips`, and `subscriptions` **feature domains**.
- Call the `domain/` directory inside a feature domain the **domain layer**.
- Avoid the standalone word “domain” when the intended meaning could be ambiguous.

## Feature-Domain Boundaries

- Never import another feature domain's `presentation`, `application`, `domain`, or `infrastructure` internals directly.
- Move types, guards, helpers, ports, and contracts shared by multiple feature domains to `src/shared`.
- Keep shared authentication contracts in `src/shared/types` and shared authentication guards in `src/shared/presentation/guards`.
- Keep `AuthContext`, `AuthPlatform`, `AuthProvider`, `AuthSessionMetadata`, and `JwtAccessGuard` out of the `auth` feature domain when multiple feature domains consume them.
- Do not move business concepts into `src/shared` merely to avoid defining an explicit feature-domain boundary.

## Placement Rules

- Place a business concept in the owning feature domain's domain layer.
- Place use-case inputs, outputs, ports, and application-specific models in the application layer.
- Place HTTP, request-user context, validation DTOs, and web-framework concerns in the presentation layer.
- Place Prisma repositories and external API, messaging, mail, or object-storage implementations in the infrastructure layer.
- Place only genuinely cross-feature web, authentication, error, normalization, or storage contracts in `src/shared`.
- Create one use case under `application/usecases` for each endpoint.
- Keep each DTO in the `dtos/` directory of the layer that consumes it.

## Code and Test Rules

- Follow TypeScript and NestJS module, controller, and provider conventions.
- Treat Prettier as the formatting source of truth and follow ESLint's Prettier integration.
- Name unit tests `*.spec.ts` and E2E tests `*.e2e-spec.ts`.
- Add unit tests for use cases only; do not add controller unit tests.
- Run validation commands appropriate to the change:

```bash
pnpm format
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

Run `pnpm test:e2e` when the change affects E2E behavior or an integration path. Report why any relevant validation was skipped.

## Prisma and Configuration

- Update `prisma/schema.prisma` and `prisma/migrations/` together for data-model changes.
- Document required environment-variable names and purposes without exposing real secret values.
- Keep secrets in `.env.local` and read them through `process.env`.
- Document new configuration keys in the PR description.

## Completion Checklist

- Confirm that no feature domain imports another feature domain's internal layer.
- Confirm that shared elements are not incorrectly owned by a single feature domain.
- Confirm layer responsibilities and dependency direction.
- Confirm one endpoint maps to one use case.
- Report use-case tests and all relevant lint, build, and E2E results.
