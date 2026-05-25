# Contributing to MailForge

Thank you for your interest in contributing to MailForge!

## Development Setup

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- PostgreSQL (or a Neon/Supabase cloud DB)
- Redis (local or Upstash)

### Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/mailforge.git
   cd mailforge
   ```
3. **Install dependencies:**
   ```bash
   pnpm install
   ```
4. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```
5. **Make your changes** following the guidelines below
6. **Run checks:**
   ```bash
   pnpm check
   pnpm typecheck
   ```
7. **Commit and push:**
   ```bash
   git commit -m "feat: add your feature description"
   git push origin feature/your-feature-name
   ```
8. **Open a Pull Request**

## Code Standards

### TypeScript

- **Strict mode is enforced** — zero `any` types allowed
- Use explicit types for all function parameters and return values
- Prefer `type` over `interface` for object shapes unless you need declaration merging
- Use Zod schemas for all tRPC input validation

### File Organization

- Server-only code stays in `src/server/`
- Shared utilities in `src/lib/`
- Client components in `src/components/` with colocated styles when needed
- Types in `src/types/`

### Naming Conventions

- **Files**: `kebab-case.ts` for files, `PascalCase.tsx` for React components
- **Functions**: `camelCase`
- **Types/Interfaces**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Boolean variables**: Prefix with `is`, `has`, `should`, `can` (e.g., `isLoading`, `hasAccess`)

### React Components

- Use functional components with hooks only (no class components)
- Colocate component-specific types, hooks, and styles
- Use `use client` directive only when necessary
- Prefer composition over prop drilling
- Memoize expensive computations with `useMemo`/`useCallback`

### tRPC Procedures

- All procedures must use `protectedProcedure` unless explicitly public
- Every mutation input must have Zod validation
- Use descriptive error messages with `TRPCError`
- Include proper TypeScript types for all inputs/outputs

### CSS & Styling

- Use Tailwind CSS utility classes
- Follow the existing color scheme and spacing conventions
- Avoid inline styles unless dynamically computed
- Use CSS variables from `config.ts` for theming

### Testing

- Write unit tests for utility functions
- Write integration tests for tRPC procedures
- Test React components with @testing-library/react
- Aim for meaningful test coverage, not 100% for its own sake

## Configuration

MailForge uses `src/config.ts` as the single source of truth. **Do not hardcode**
values that belong in the config. If you need to add new configuration options,
document them properly.

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new feature
fix: correct a bug
docs: update documentation
style: formatting, missing semicolons, etc.
refactor: restructure code without behavior change
test: add or update tests
chore: maintenance tasks, dependency updates
```

Examples:
- `feat: add SnoozeMessage procedure to mail router`
- `fix: handle null subject in message list`
- `docs: update Gmail IMAP setup instructions`

## Pull Request Process

### Before Submitting

1. Ensure all checks pass: `pnpm check`
2. Update documentation if needed
3. Add tests for new functionality
4. Keep PRs focused — one feature or fix per PR

### PR Description

Include in your PR description:
- **What**: Brief description of the change
- **Why**: Context and motivation
- **How**: Technical approach (if non-obvious)
- **Testing**: How you tested the change

### Review Process

- PRs require at least one approval before merge
- Address all review comments
- Keep commits clean and atomic
- Squash commits before merging if requested

## Reporting Issues

See [ISSUE_TEMPLATE](./ISSUE_TEMPLATE/) for issue reporting guidelines.

## License

By contributing, you agree that your contributions will be licensed
under the MIT License.