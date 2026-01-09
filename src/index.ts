#!/usr/bin/env node

import { program } from 'commander'
import { registerTaskCommand } from './commands/task.js'
import { registerProjectCommand } from './commands/project.js'
import { registerLabelCommand } from './commands/label.js'
import { registerCommentCommand } from './commands/comment.js'
import { registerSectionCommand } from './commands/section.js'
import { getApi, type Project } from './lib/api.js'
import { formatDue, formatTaskRow } from './lib/output.js'
import { listTasksForProject, type TaskListOptions } from './lib/task-list.js'
import chalk from 'chalk'

program
  .name('td')
  .description('Todoist CLI')
  .version('0.1.0')

program
  .command('add <text>')
  .description('Quick add task with natural language (e.g., "Buy milk tomorrow p1 #Shopping")')
  .action(async (text: string) => {
    const api = await getApi()
    const task = await api.quickAddTask({ text })
    console.log(`Created: ${task.content}`)
    if (task.due) console.log(`Due: ${formatDue(task.due)}`)
    console.log(chalk.dim(`ID: ${task.id}`))
  })

program
  .command('today')
  .description('Show tasks due today and overdue')
  .action(async () => {
    const api = await getApi()
    const { results: tasks } = await api.getTasks()
    const { results: allProjects } = await api.getProjects()
    const projects = new Map<string, Project>(allProjects.map((p) => [p.id, p]))

    const today = new Date().toISOString().split('T')[0]

    const overdue = tasks.filter((t) => t.due && t.due.date < today)
    const dueToday = tasks.filter((t) => t.due?.date === today)

    if (overdue.length === 0 && dueToday.length === 0) {
      console.log('No tasks due today.')
      return
    }

    if (overdue.length === 0) {
      for (const task of dueToday) {
        console.log(formatTaskRow(task, projects.get(task.projectId)?.name))
      }
      return
    }

    console.log(chalk.red.bold('Overdue'))
    for (const task of overdue) {
      console.log(formatTaskRow(task, projects.get(task.projectId)?.name))
    }

    if (dueToday.length > 0) {
      console.log('')
      console.log(chalk.bold('Today'))
      for (const task of dueToday) {
        console.log(formatTaskRow(task, projects.get(task.projectId)?.name))
      }
    }
  })

program
  .command('inbox')
  .description('List tasks in Inbox')
  .option('--priority <p1-p4>', 'Filter by priority')
  .option('--due <date>', 'Filter by due date (today, overdue, or YYYY-MM-DD)')
  .option('--limit <n>', 'Limit number of results', '50')
  .option('--json', 'Output as JSON array')
  .option('--ndjson', 'Output as newline-delimited JSON')
  .action(async (options: TaskListOptions) => {
    const api = await getApi()
    const user = await api.getUser()
    await listTasksForProject(user.inboxProjectId, options)
  })

registerTaskCommand(program)
registerProjectCommand(program)
registerLabelCommand(program)
registerCommentCommand(program)
registerSectionCommand(program)

program.parse()
