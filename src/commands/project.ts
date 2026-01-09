import { Command } from 'commander'
import { getApi, fetchWorkspaces, fetchWorkspaceFolders, isWorkspaceProject, type Project, type Workspace } from '../lib/api.js'
import { formatPaginatedJson, formatPaginatedNdjson, formatNextCursorFooter, formatError } from '../lib/output.js'
import { paginate, LIMITS } from '../lib/pagination.js'
import { resolveProjectRef } from '../lib/refs.js'
import { formatUserShortName } from '../lib/collaborators.js'
import chalk from 'chalk'

interface ListOptions {
  limit?: string
  cursor?: string
  all?: boolean
  personal?: boolean
  json?: boolean
  ndjson?: boolean
  full?: boolean
}

async function listProjects(options: ListOptions): Promise<void> {
  const api = await getApi()

  const targetLimit = options.all
    ? Number.MAX_SAFE_INTEGER
    : options.limit
      ? parseInt(options.limit, 10)
      : LIMITS.projects

  const { results: projects, nextCursor } = await paginate(
    (cursor, limit) => api.getProjects({ cursor: cursor ?? undefined, limit }),
    { limit: targetLimit, startCursor: options.cursor }
  )

  if (options.json) {
    console.log(formatPaginatedJson({ results: projects, nextCursor }, 'project', options.full))
    return
  }

  if (options.ndjson) {
    console.log(formatPaginatedNdjson({ results: projects, nextCursor }, 'project', options.full))
    return
  }

  if (options.personal) {
    const personalOnly = projects.filter((p) => !isWorkspaceProject(p))
    for (const project of personalOnly) {
      const id = chalk.dim(project.id)
      let name = project.isFavorite ? chalk.yellow(project.name) : project.name
      if (project.isShared) {
        name = `${name} ${chalk.dim('[shared]')}`
      }
      console.log(`${id}  ${name}`)
    }
    console.log(formatNextCursorFooter(nextCursor))
    return
  }

  const workspaceProjects = new Map<string, Project[]>()
  const personalProjects: Project[] = []

  for (const project of projects) {
    if (isWorkspaceProject(project)) {
      const list = workspaceProjects.get(project.workspaceId) || []
      list.push(project)
      workspaceProjects.set(project.workspaceId, list)
    } else {
      personalProjects.push(project)
    }
  }

  let workspaces: Workspace[] = []
  if (workspaceProjects.size > 0) {
    workspaces = await fetchWorkspaces()
  }
  const workspaceMap = new Map(workspaces.map((w) => [w.id, w]))

  if (personalProjects.length > 0) {
    if (workspaceProjects.size > 0) {
      console.log(chalk.bold('Personal'))
    }
    for (const project of personalProjects) {
      const id = chalk.dim(project.id)
      let name = project.isFavorite ? chalk.yellow(project.name) : project.name
      if (project.isShared) {
        name = `${name} ${chalk.dim('[shared]')}`
      }
      const indent = workspaceProjects.size > 0 ? '  ' : ''
      console.log(`${indent}${id}  ${name}`)
    }
    if (workspaceProjects.size > 0) {
      console.log('')
    }
  }

  const sortedWorkspaceIds = [...workspaceProjects.keys()].sort((a, b) => {
    const nameA = workspaceMap.get(a)?.name ?? ''
    const nameB = workspaceMap.get(b)?.name ?? ''
    return nameA.localeCompare(nameB)
  })

  for (const workspaceId of sortedWorkspaceIds) {
    const wprojects = workspaceProjects.get(workspaceId)!
    const workspace = workspaceMap.get(workspaceId)
    const workspaceName = workspace?.name ?? `Workspace ${workspaceId}`
    console.log(chalk.bold(workspaceName))
    for (const project of wprojects) {
      const id = chalk.dim(project.id)
      const name = project.isFavorite ? chalk.yellow(project.name) : project.name
      console.log(`  ${id}  ${name}`)
    }
    console.log('')
  }
  console.log(formatNextCursorFooter(nextCursor))

  if (sortedWorkspaceIds.length > 0) {
    console.log(chalk.dim('Tip: Use `td workspace projects <name>` for a detailed view with folders.'))
  }
}

async function viewProject(ref: string): Promise<void> {
  const api = await getApi()
  const project = await resolveProjectRef(api, ref)

  console.log(chalk.bold(project.name))
  console.log('')
  console.log(`ID:       ${project.id}`)

  if (isWorkspaceProject(project)) {
    const [workspaces, folders] = await Promise.all([
      fetchWorkspaces(),
      fetchWorkspaceFolders(),
    ])
    const workspace = workspaces.find((w) => w.id === project.workspaceId)
    if (workspace) {
      console.log(`Workspace: ${workspace.name}`)
    }
    if (project.folderId) {
      const folder = folders.find((f) => f.id === project.folderId)
      if (folder) {
        console.log(`Folder:   ${folder.name}`)
      }
    }
  } else if (project.isShared) {
    console.log(`Shared:   Yes`)
  }

  console.log(`Color:    ${project.color}`)
  console.log(`Favorite: ${project.isFavorite ? 'Yes' : 'No'}`)
  console.log(`URL:      ${project.url}`)

  const { results: tasks } = await api.getTasks({ projectId: project.id })

  if (tasks.length > 0) {
    console.log('')
    console.log(chalk.dim(`--- Tasks (${tasks.length}) ---`))
    for (const task of tasks) {
      const priority = chalk.dim(`p${5 - task.priority}`)
      console.log(`  ${priority}  ${task.content}`)
    }
  }
}

async function listCollaborators(ref: string): Promise<void> {
  const api = await getApi()
  const project = await resolveProjectRef(api, ref)

  if (isWorkspaceProject(project)) {
    const workspaceIdNum = parseInt(project.workspaceId, 10)
    let cursor: string | undefined

    while (true) {
      const response = await api.getWorkspaceUsers({
        workspaceId: workspaceIdNum,
        cursor,
        limit: 200,
      })

      for (const user of response.workspaceUsers) {
        const id = chalk.dim(user.userId)
        const name = formatUserShortName(user.fullName)
        const email = chalk.dim(`<${user.userEmail}>`)
        const role = chalk.dim(`[${user.role}]`)
        console.log(`${id}  ${name} ${email} ${role}`)
      }

      if (!response.hasMore || !response.nextCursor) break
      cursor = response.nextCursor
    }
    return
  }

  if (!project.isShared) {
    throw new Error(formatError('NOT_SHARED', 'Project is not shared.'))
  }

  let cursor: string | undefined
  while (true) {
    const response = await api.getProjectCollaborators(project.id, { cursor })

    for (const user of response.results) {
      const id = chalk.dim(user.id)
      const name = formatUserShortName(user.name)
      const email = chalk.dim(`<${user.email}>`)
      console.log(`${id}  ${name} ${email}`)
    }

    if (!response.nextCursor) break
    cursor = response.nextCursor
  }
}

export function registerProjectCommand(program: Command): void {
  const project = program.command('project').description('Manage projects')

  project
    .command('list')
    .description('List all projects')
    .option('--limit <n>', 'Limit number of results (default: 50)')
    .option('--cursor <cursor>', 'Continue from cursor')
    .option('--all', 'Fetch all results (no limit)')
    .option('--personal', 'Show only personal projects')
    .option('--json', 'Output as JSON')
    .option('--ndjson', 'Output as newline-delimited JSON')
    .option('--full', 'Include all fields in JSON output')
    .action(listProjects)

  project
    .command('view <ref>')
    .description('View project details')
    .action(viewProject)

  project
    .command('collaborators <ref>')
    .description('List project collaborators')
    .action(listCollaborators)
}
