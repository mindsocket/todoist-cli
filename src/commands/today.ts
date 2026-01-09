import { Command } from 'commander'
import { getApi, getCurrentUserId, isWorkspaceProject, type Project } from '../lib/api.js'
import { formatTaskRow, formatPaginatedJson, formatPaginatedNdjson, formatNextCursorFooter, formatError } from '../lib/output.js'
import { paginate, LIMITS } from '../lib/pagination.js'
import { getLocalDate } from '../lib/dates.js'
import { CollaboratorCache, formatAssignee } from '../lib/collaborators.js'
import { resolveWorkspaceRef } from '../lib/refs.js'
import chalk from 'chalk'

interface TodayOptions {
  limit?: string
  cursor?: string
  all?: boolean
  anyAssignee?: boolean
  workspace?: string
  personal?: boolean
  json?: boolean
  ndjson?: boolean
  full?: boolean
}

export function registerTodayCommand(program: Command): void {
  program
    .command('today')
    .description('Show tasks due today and overdue')
    .option('--limit <n>', 'Limit number of results (default: 300)')
    .option('--cursor <cursor>', 'Continue from cursor')
    .option('--all', 'Fetch all results (no limit)')
    .option('--any-assignee', 'Show tasks assigned to anyone (default: only me/unassigned)')
    .option('--workspace <name>', 'Filter to tasks in workspace')
    .option('--personal', 'Filter to tasks in personal projects')
    .option('--json', 'Output as JSON')
    .option('--ndjson', 'Output as newline-delimited JSON')
    .option('--full', 'Include all fields in JSON output')
    .action(async (options: TodayOptions) => {
      const api = await getApi()

      const targetLimit = options.all
        ? Number.MAX_SAFE_INTEGER
        : options.limit
          ? parseInt(options.limit, 10)
          : LIMITS.tasks

      const { results: tasks, nextCursor } = await paginate(
        (cursor, limit) => api.getTasks({ cursor: cursor ?? undefined, limit }),
        { limit: targetLimit, startCursor: options.cursor }
      )

      const today = getLocalDate(0)

      let filteredTasks = tasks
      if (!options.anyAssignee) {
        const currentUserId = await getCurrentUserId()
        filteredTasks = tasks.filter(
          (t) => !t.responsibleUid || t.responsibleUid === currentUserId
        )
      }

      if (options.workspace && options.personal) {
        throw new Error(
          formatError('CONFLICTING_FILTERS', '--workspace and --personal are mutually exclusive.')
        )
      }

      if (options.workspace || options.personal) {
        const { results: allProjects } = await api.getProjects()
        const projectsMap = new Map(allProjects.map((p) => [p.id, p]))

        if (options.workspace) {
          const workspace = await resolveWorkspaceRef(options.workspace)
          filteredTasks = filteredTasks.filter((t) => {
            const project = projectsMap.get(t.projectId)
            return project && isWorkspaceProject(project) && project.workspaceId === workspace.id
          })
        } else if (options.personal) {
          filteredTasks = filteredTasks.filter((t) => {
            const project = projectsMap.get(t.projectId)
            return project && !isWorkspaceProject(project)
          })
        }
      }

      const overdue = filteredTasks.filter((t) => t.due && t.due.date < today)
      const dueToday = filteredTasks.filter((t) => t.due?.date === today)
      const allTodayTasks = [...overdue, ...dueToday]

      if (options.json) {
        console.log(formatPaginatedJson({ results: allTodayTasks, nextCursor }, 'task', options.full))
        return
      }

      if (options.ndjson) {
        console.log(formatPaginatedNdjson({ results: allTodayTasks, nextCursor }, 'task', options.full))
        return
      }

      const { results: allProjects } = await api.getProjects()
      const projects = new Map<string, Project>(allProjects.map((p) => [p.id, p]))

      const collaboratorCache = new CollaboratorCache()
      await collaboratorCache.preload(api, allTodayTasks, projects)

      if (overdue.length === 0 && dueToday.length === 0) {
        console.log('No tasks due today.')
        console.log(formatNextCursorFooter(nextCursor))
        return
      }

      if (overdue.length > 0) {
        console.log(chalk.red.bold(`Overdue (${overdue.length})`))
        for (const task of overdue) {
          const assignee = formatAssignee(task.responsibleUid, task.projectId, projects, collaboratorCache)
          console.log(formatTaskRow(task, projects.get(task.projectId)?.name, assignee ?? undefined))
          console.log('')
        }
      }

      console.log(chalk.bold(`Today (${dueToday.length})`))
      for (const task of dueToday) {
        const assignee = formatAssignee(task.responsibleUid, task.projectId, projects, collaboratorCache)
        console.log(formatTaskRow(task, projects.get(task.projectId)?.name, assignee ?? undefined))
        console.log('')
      }
      console.log(formatNextCursorFooter(nextCursor))
    })
}
