import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'

vi.mock('../lib/api.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api.js')>()
  return {
    ...actual,
    getApi: vi.fn(),
    fetchWorkspaces: vi.fn().mockResolvedValue([]),
    fetchWorkspaceFolders: vi.fn().mockResolvedValue([]),
  }
})

import { getApi, fetchWorkspaces, fetchWorkspaceFolders } from '../lib/api.js'
import { registerProjectCommand } from '../commands/project.js'

const mockFetchWorkspaces = vi.mocked(fetchWorkspaces)
const mockFetchWorkspaceFolders = vi.mocked(fetchWorkspaceFolders)

const mockGetApi = vi.mocked(getApi)

function createMockApi() {
  return {
    getProjects: vi.fn().mockResolvedValue({ results: [], nextCursor: null }),
    getProject: vi.fn(),
    getTasks: vi.fn().mockResolvedValue({ results: [], nextCursor: null }),
  }
}

function createProgram() {
  const program = new Command()
  program.exitOverride()
  registerProjectCommand(program)
  return program
}

describe('project list', () => {
  let mockApi: ReturnType<typeof createMockApi>
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockApi = createMockApi()
    mockGetApi.mockResolvedValue(mockApi as any)
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('lists all projects', async () => {
    const program = createProgram()

    mockApi.getProjects.mockResolvedValue({
      results: [
        { id: 'proj-1', name: 'Work', isFavorite: false },
        { id: 'proj-2', name: 'Personal', isFavorite: false },
      ],
      nextCursor: null,
    })

    await program.parseAsync(['node', 'td', 'project', 'list'])

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Work'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Personal'))
  })

  it('outputs JSON with --json flag', async () => {
    const program = createProgram()

    mockApi.getProjects.mockResolvedValue({
      results: [{ id: 'proj-1', name: 'Work', isFavorite: true }],
      nextCursor: null,
    })

    await program.parseAsync(['node', 'td', 'project', 'list', '--json'])

    const output = consoleSpy.mock.calls[0][0]
    const parsed = JSON.parse(output)
    expect(parsed.results).toBeDefined()
    expect(parsed.results[0].name).toBe('Work')
  })

  it('outputs NDJSON with --ndjson flag', async () => {
    const program = createProgram()

    mockApi.getProjects.mockResolvedValue({
      results: [
        { id: 'proj-1', name: 'Work' },
        { id: 'proj-2', name: 'Personal' },
      ],
      nextCursor: null,
    })

    await program.parseAsync(['node', 'td', 'project', 'list', '--ndjson'])

    const output = consoleSpy.mock.calls[0][0]
    const lines = output.split('\n')
    expect(lines).toHaveLength(2)
  })

  it('shows cursor footer when more results exist', async () => {
    const program = createProgram()

    mockApi.getProjects.mockResolvedValue({
      results: [{ id: 'proj-1', name: 'Work' }],
      nextCursor: 'cursor-123',
    })

    await program.parseAsync(['node', 'td', 'project', 'list'])

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('more items exist'))
  })
})

describe('project view', () => {
  let mockApi: ReturnType<typeof createMockApi>
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockApi = createMockApi()
    mockGetApi.mockResolvedValue(mockApi as any)
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('resolves project by name', async () => {
    const program = createProgram()

    mockApi.getProjects.mockResolvedValue({
      results: [{ id: 'proj-1', name: 'Work', color: 'blue', isFavorite: true, url: 'https://...' }],
      nextCursor: null,
    })
    mockApi.getTasks.mockResolvedValue({ results: [], nextCursor: null })

    await program.parseAsync(['node', 'td', 'project', 'view', 'Work'])

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Work'))
  })

  it('resolves project by id: prefix', async () => {
    const program = createProgram()

    mockApi.getProject.mockResolvedValue({
      id: 'proj-1',
      name: 'Work',
      color: 'blue',
      isFavorite: false,
      url: 'https://...',
    })
    mockApi.getTasks.mockResolvedValue({ results: [], nextCursor: null })

    await program.parseAsync(['node', 'td', 'project', 'view', 'id:proj-1'])

    expect(mockApi.getProject).toHaveBeenCalledWith('proj-1')
  })

  it('shows project details', async () => {
    const program = createProgram()

    mockApi.getProject.mockResolvedValue({
      id: 'proj-1',
      name: 'Work',
      color: 'blue',
      isFavorite: true,
      url: 'https://todoist.com/app/project/proj-1',
    })
    mockApi.getTasks.mockResolvedValue({ results: [], nextCursor: null })

    await program.parseAsync(['node', 'td', 'project', 'view', 'id:proj-1'])

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ID:'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Color:'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Favorite:'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('URL:'))
  })

  it('lists tasks in project', async () => {
    const program = createProgram()

    mockApi.getProject.mockResolvedValue({
      id: 'proj-1',
      name: 'Work',
      color: 'blue',
      isFavorite: false,
      url: 'https://...',
    })
    mockApi.getTasks.mockResolvedValue({
      results: [
        { id: 'task-1', content: 'Task A', priority: 4 },
        { id: 'task-2', content: 'Task B', priority: 1 },
      ],
      nextCursor: null,
    })

    await program.parseAsync(['node', 'td', 'project', 'view', 'id:proj-1'])

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Tasks (2)'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Task A'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Task B'))
  })

  it('throws for non-existent project', async () => {
    const program = createProgram()

    mockApi.getProjects.mockResolvedValue({ results: [], nextCursor: null })

    await expect(
      program.parseAsync(['node', 'td', 'project', 'view', 'nonexistent'])
    ).rejects.toThrow('not found')
  })

  it('shows workspace info for workspace project', async () => {
    const program = createProgram()

    mockApi.getProject.mockResolvedValue({
      id: 'proj-1',
      name: 'Work Project',
      color: 'blue',
      isFavorite: false,
      url: 'https://...',
      workspaceId: 'ws-1',
      folderId: 'folder-1',
    })
    mockApi.getTasks.mockResolvedValue({ results: [], nextCursor: null })
    mockFetchWorkspaces.mockResolvedValue([{ id: 'ws-1', name: 'Acme Corp' } as any])
    mockFetchWorkspaceFolders.mockResolvedValue([{ id: 'folder-1', name: 'Engineering', workspaceId: 'ws-1' }])

    await program.parseAsync(['node', 'td', 'project', 'view', 'id:proj-1'])

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Workspace:'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Acme Corp'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Folder:'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Engineering'))
  })

  it('shows shared status for shared personal project', async () => {
    const program = createProgram()

    mockApi.getProject.mockResolvedValue({
      id: 'proj-1',
      name: 'Shared Project',
      color: 'blue',
      isFavorite: false,
      url: 'https://...',
      isShared: true,
    })
    mockApi.getTasks.mockResolvedValue({ results: [], nextCursor: null })

    await program.parseAsync(['node', 'td', 'project', 'view', 'id:proj-1'])

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Shared:'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Yes'))
  })
})

describe('project list grouping', () => {
  let mockApi: ReturnType<typeof createMockApi>
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockApi = createMockApi()
    mockGetApi.mockResolvedValue(mockApi as any)
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('groups projects by workspace', async () => {
    const program = createProgram()

    mockApi.getProjects.mockResolvedValue({
      results: [
        { id: 'proj-1', name: 'Work Project', isFavorite: false, workspaceId: 'ws-1' },
        { id: 'proj-2', name: 'Personal', isFavorite: false },
      ],
      nextCursor: null,
    })
    mockFetchWorkspaces.mockResolvedValue([{ id: 'ws-1', name: 'Acme Corp' } as any])

    await program.parseAsync(['node', 'td', 'project', 'list'])

    const calls = consoleSpy.mock.calls.map((c: unknown[]) => c[0] as string)
    expect(calls.some((c: string) => c.includes('Acme Corp'))).toBe(true)
    expect(calls.some((c: string) => c.includes('Personal'))).toBe(true)
  })

  it('shows [shared] marker for shared personal projects', async () => {
    const program = createProgram()

    mockApi.getProjects.mockResolvedValue({
      results: [
        { id: 'proj-1', name: 'Shared Project', isFavorite: false, isShared: true },
        { id: 'proj-2', name: 'Private Project', isFavorite: false, isShared: false },
      ],
      nextCursor: null,
    })

    await program.parseAsync(['node', 'td', 'project', 'list'])

    const calls = consoleSpy.mock.calls.map((c: unknown[]) => c[0] as string)
    expect(calls.some((c: string) => c.includes('Shared Project') && c.includes('[shared]'))).toBe(true)
    expect(calls.some((c: string) => c.includes('Private Project') && !c.includes('[shared]'))).toBe(true)
  })

  it('lists personal projects before workspace projects', async () => {
    const program = createProgram()

    mockApi.getProjects.mockResolvedValue({
      results: [
        { id: 'proj-1', name: 'Work Project', isFavorite: false, workspaceId: 'ws-1' },
        { id: 'proj-2', name: 'My Personal', isFavorite: false },
      ],
      nextCursor: null,
    })
    mockFetchWorkspaces.mockResolvedValue([{ id: 'ws-1', name: 'Acme Corp' } as any])

    await program.parseAsync(['node', 'td', 'project', 'list'])

    const calls = consoleSpy.mock.calls.map((c: unknown[]) => c[0] as string)
    const personalIndex = calls.findIndex((c: string) => c.includes('Personal'))
    const workspaceIndex = calls.findIndex((c: string) => c.includes('Acme Corp'))
    expect(personalIndex).toBeLessThan(workspaceIndex)
  })

  it('sorts workspaces alphabetically by name', async () => {
    const program = createProgram()

    mockApi.getProjects.mockResolvedValue({
      results: [
        { id: 'proj-1', name: 'Zebra Project', isFavorite: false, workspaceId: 'ws-z' },
        { id: 'proj-2', name: 'Alpha Project', isFavorite: false, workspaceId: 'ws-a' },
      ],
      nextCursor: null,
    })
    mockFetchWorkspaces.mockResolvedValue([
      { id: 'ws-z', name: 'Zebra Corp' } as any,
      { id: 'ws-a', name: 'Alpha Inc' } as any,
    ])

    await program.parseAsync(['node', 'td', 'project', 'list'])

    const calls = consoleSpy.mock.calls.map((c: unknown[]) => c[0] as string)
    const alphaIndex = calls.findIndex((c: string) => c.includes('Alpha Inc'))
    const zebraIndex = calls.findIndex((c: string) => c.includes('Zebra Corp'))
    expect(alphaIndex).toBeLessThan(zebraIndex)
  })
})

describe('project collaborators', () => {
  let mockApi: ReturnType<typeof createMockApi> & {
    getWorkspaceUsers: ReturnType<typeof vi.fn>
    getProjectCollaborators: ReturnType<typeof vi.fn>
  }
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockApi = {
      ...createMockApi(),
      getWorkspaceUsers: vi.fn(),
      getProjectCollaborators: vi.fn(),
    }
    mockGetApi.mockResolvedValue(mockApi as any)
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('lists workspace users for workspace project', async () => {
    const program = createProgram()

    mockApi.getProject.mockResolvedValue({
      id: 'proj-1',
      name: 'Work Project',
      workspaceId: '123',
    })
    mockApi.getWorkspaceUsers.mockResolvedValue({
      workspaceUsers: [
        { userId: 'user-1', fullName: 'John Doe', userEmail: 'john@example.com', role: 'MEMBER' },
      ],
      hasMore: false,
    })

    await program.parseAsync(['node', 'td', 'project', 'collaborators', 'id:proj-1'])

    expect(mockApi.getWorkspaceUsers).toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('John D.'))
  })

  it('lists collaborators for shared personal project', async () => {
    const program = createProgram()

    mockApi.getProject.mockResolvedValue({
      id: 'proj-1',
      name: 'Shared Project',
      isShared: true,
    })
    mockApi.getProjectCollaborators.mockResolvedValue({
      results: [
        { id: 'user-1', name: 'Jane Smith', email: 'jane@example.com' },
      ],
      nextCursor: null,
    })

    await program.parseAsync(['node', 'td', 'project', 'collaborators', 'id:proj-1'])

    expect(mockApi.getProjectCollaborators).toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Jane S.'))
  })

  it('throws error for non-shared project', async () => {
    const program = createProgram()

    mockApi.getProject.mockResolvedValue({
      id: 'proj-1',
      name: 'Private Project',
      isShared: false,
    })

    await expect(
      program.parseAsync(['node', 'td', 'project', 'collaborators', 'id:proj-1'])
    ).rejects.toThrow('not shared')
  })
})
