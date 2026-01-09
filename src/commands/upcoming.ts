import { Command } from 'commander'
import { getApi, type Project, type Task } from '../lib/api.js'
import { formatTaskRow, formatPaginatedJson, formatPaginatedNdjson, formatNextCursorFooter } from '../lib/output.js'
import { paginate, LIMITS } from '../lib/pagination.js'
import { getLocalDate, formatDateHeader } from '../lib/dates.js'
import chalk from 'chalk'

interface UpcomingOptions {
  limit?: string
  cursor?: string
  all?: boolean
  json?: boolean
  ndjson?: boolean
  full?: boolean
}

export function registerUpcomingCommand(program: Command): void {
  program
    .command('upcoming [days]')
    .description('Show tasks due in the next N days (default: 7)')
    .option('--limit <n>', 'Limit number of results (default: 300)')
    .option('--cursor <cursor>', 'Continue from cursor')
    .option('--all', 'Fetch all results (no limit)')
    .option('--json', 'Output as JSON')
    .option('--ndjson', 'Output as newline-delimited JSON')
    .option('--full', 'Include all fields in JSON output')
    .action(async (daysArg: string | undefined, options: UpcomingOptions) => {
      const days = daysArg ? parseInt(daysArg, 10) : 7
      if (isNaN(days) || days < 1) {
        console.error('Days must be a positive number')
        process.exitCode = 1
        return
      }

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
      const endDate = getLocalDate(days)

      const relevantTasks = tasks.filter(
        (t) => t.due && t.due.date < endDate
      )

      if (options.json) {
        console.log(formatPaginatedJson({ results: relevantTasks, nextCursor }, 'task', options.full))
        return
      }

      if (options.ndjson) {
        console.log(formatPaginatedNdjson({ results: relevantTasks, nextCursor }, 'task', options.full))
        return
      }

      const { results: allProjects } = await api.getProjects()
      const projects = new Map<string, Project>(allProjects.map((p) => [p.id, p]))

      if (relevantTasks.length === 0) {
        console.log(`No tasks due in the next ${days} day${days === 1 ? '' : 's'}.`)
        console.log(formatNextCursorFooter(nextCursor))
        return
      }

      const overdue: Task[] = []
      const byDate = new Map<string, Task[]>()

      for (const task of relevantTasks) {
        const dueDate = task.due!.date
        if (dueDate < today) {
          overdue.push(task)
        } else {
          const list = byDate.get(dueDate) || []
          list.push(task)
          byDate.set(dueDate, list)
        }
      }

      if (overdue.length > 0) {
        console.log(chalk.red.bold(`Overdue (${overdue.length})`))
        for (const task of overdue) {
          console.log(formatTaskRow(task, projects.get(task.projectId)?.name))
        }
        console.log('')
      }

      const sortedDates = Array.from(byDate.keys()).sort()
      for (let i = 0; i < sortedDates.length; i++) {
        const date = sortedDates[i]
        const dateTasks = byDate.get(date)!
        const header = formatDateHeader(date, today)
        console.log(chalk.bold(`${header} (${dateTasks.length})`))
        for (const task of dateTasks) {
          console.log(formatTaskRow(task, projects.get(task.projectId)?.name))
        }
        if (i < sortedDates.length - 1) {
          console.log('')
        }
      }

      console.log(formatNextCursorFooter(nextCursor))
    })
}
