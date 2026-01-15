# Todoist CLI

TypeScript CLI for Todoist. Binary name: `td`.

## Build & Run

```bash
npm run build       # compile TypeScript
npm run dev         # watch mode
npm run type-check  # type check
npm run format      # format code
npm test            # run tests
```

**Run the CLI directly** (no linking needed):

```bash
node dist/index.js --help          # show commands
node dist/index.js today           # run 'today' command
node dist/index.js <command> ...   # run any command
```

Use this to verify changes work before committing.

## Architecture

```
src/
  index.ts              # entry point, registers all commands
  commands/             # one file per command group
    add.ts              # td add (quick add)
    auth.ts             # td auth (login, token, status, logout)
    today.ts            # td today
    inbox.ts            # td inbox
    task.ts             # td task <action>
    project.ts          # td project <action>
    label.ts            # td label <action>
    comment.ts          # td comment <action>
    section.ts          # td section <action>
  lib/
    api.ts              # API client wrapper, type exports
    auth.ts             # token loading/saving (env var or config file)
    output.ts           # formatting utilities
    refs.ts             # id: prefix parsing utilities
    task-list.ts        # shared task listing logic
```

## Key Patterns

- **ID references**: All explicit IDs use `id:` prefix. Use `requireIdRef()` for ID-only args, `isIdRef()`/`extractId()` for mixed refs (fuzzy name + explicit ID)
- **API responses**: Client returns `{ results: T[], nextCursor? }` - always destructure
- **Priority mapping**: API uses 4=p1 (highest), 1=p4 (lowest)
- **Command registration**: Each command exports `registerXxxCommand(program: Command)` function

## Testing

Tests use vitest with mocked API. Run `npm test` before committing.

- All commands and lib modules have tests in `src/__tests__/`
- Shared mock factory in `helpers/mock-api.ts`, fixtures in `helpers/fixtures.ts`
- When adding features, add corresponding tests
- Pattern: mock `getApi`, use `program.parseAsync()` to test commands

## Auth

Token from `TODOIST_API_TOKEN` env var or `~/.config/todoist-cli/config.json`:

```json
{ "api_token": "your-api-token" }
```
