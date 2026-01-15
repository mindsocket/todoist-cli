# Todoist CLI

A command-line interface for Todoist.

## Installation

> **Note**: This package is not yet published to npm. Once published, install with:
>
> ```bash
> npm install -g @doist/todoist-cli
> ```

### Local Setup (for now)

```bash
git clone https://github.com/Doist/todoist-cli.git
cd todoist-cli
npm install
npm run build
npm link
```

This makes the `td` command available globally.

## Setup

Get your Todoist API token from [Todoist Settings > Integrations > Developer](https://todoist.com/app/settings/integrations/developer), then:

```bash
td login token "your-token"
```

Alternatively, set an environment variable:

```bash
export TODOIST_API_TOKEN="your-token"
```

## Usage

```bash
td add "Buy milk tomorrow #Shopping"   # quick add with natural language
td today                               # tasks due today + overdue
td inbox                               # inbox tasks
td task list                           # all tasks
td task list --project "Work"          # tasks in project
td project list                        # all projects
```

Run `td --help` or `td <command> --help` for more options.

## Development

```bash
npm install
npm run build       # compile
npm run dev         # watch mode
npm run type-check  # type check
npm run format      # format code
npm test            # run tests
```
