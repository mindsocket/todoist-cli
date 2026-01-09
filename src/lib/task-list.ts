import { getApi, type Project } from './api.js'
import { formatTaskList, formatJson, formatNdjson, formatError } from './output.js'
import type { Task } from '@doist/todoist-api-typescript'

export interface TaskListOptions {
  priority?: string
  due?: string
  filter?: string
  limit?: string
  json?: boolean
  ndjson?: boolean
}

export function parsePriority(p: string): number {
  const match = /^p([1-4])$/.exec(p.toLowerCase())
  if (!match) {
    throw new Error(
      formatError('INVALID_PRIORITY', `Invalid priority "${p}". Use p1, p2, p3, or p4.`)
    )
  }
  return 5 - parseInt(match[1], 10)
}

export async function listTasksForProject(
  projectId: string | null,
  options: TaskListOptions
): Promise<void> {
  const api = await getApi()

  let tasks: Task[]
  let projects: Map<string, Project> | undefined

  if (projectId) {
    const response = await api.getTasks({ projectId })
    tasks = response.results
  } else {
    const response = await api.getTasks()
    tasks = response.results
  }

  if (options.priority) {
    const priority = parsePriority(options.priority)
    tasks = tasks.filter((t) => t.priority === priority)
  }

  if (options.due) {
    const today = new Date().toISOString().split('T')[0]
    if (options.due === 'today') {
      tasks = tasks.filter((t) => t.due?.date === today)
    } else if (options.due === 'overdue') {
      tasks = tasks.filter((t) => t.due && t.due.date < today)
    } else {
      tasks = tasks.filter((t) => t.due?.date === options.due)
    }
  }

  const limit = options.limit ? parseInt(options.limit, 10) : 50
  tasks = tasks.slice(0, limit)

  if (!options.json && !options.ndjson && tasks.length > 0) {
    const { results: allProjects } = await api.getProjects()
    projects = new Map(allProjects.map((p) => [p.id, p]))
  }

  if (options.json) {
    console.log(formatJson(tasks))
  } else if (options.ndjson) {
    console.log(formatNdjson(tasks))
  } else {
    console.log(formatTaskList(tasks, projects))
  }
}
