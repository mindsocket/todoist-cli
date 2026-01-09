import { Command } from 'commander'
import { getApi, type Project } from '../lib/api.js'
import { formatTaskRow, formatJson, formatNdjson } from '../lib/output.js'
import chalk from 'chalk'

interface TodayOptions {
  json?: boolean
  ndjson?: boolean
}

export function registerTodayCommand(program: Command): void {
  program
    .command('today')
    .description('Show tasks due today and overdue')
    .option('--json', 'Output as JSON array')
    .option('--ndjson', 'Output as newline-delimited JSON')
    .action(async (options: TodayOptions) => {
      const api = await getApi()
      const { results: tasks } = await api.getTasks()

      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      const overdue = tasks.filter((t) => t.due && t.due.date < today)
      const dueToday = tasks.filter((t) => t.due?.date === today)
      const allTodayTasks = [...overdue, ...dueToday]

      if (options.json) {
        console.log(formatJson(allTodayTasks))
        return
      }

      if (options.ndjson) {
        console.log(formatNdjson(allTodayTasks))
        return
      }

      const { results: allProjects } = await api.getProjects()
      const projects = new Map<string, Project>(allProjects.map((p) => [p.id, p]))

      if (overdue.length === 0 && dueToday.length === 0) {
        console.log('No tasks due today.')
        return
      }

      if (overdue.length > 0) {
        console.log(chalk.red.bold(`Overdue (${overdue.length})`))
        for (const task of overdue) {
          console.log(formatTaskRow(task, projects.get(task.projectId)?.name))
        }
        console.log('')
      }

      console.log(chalk.bold(`Today (${dueToday.length})`))
      for (const task of dueToday) {
        console.log(formatTaskRow(task, projects.get(task.projectId)?.name))
      }
    })
}
