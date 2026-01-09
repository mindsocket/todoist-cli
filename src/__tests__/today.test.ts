import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'

vi.mock('../lib/api.js', () => ({
  getApi: vi.fn(),
  getCurrentUserId: vi.fn().mockResolvedValue('current-user-123'),
  isWorkspaceProject: vi.fn().mockReturnValue(false),
}))

import { getApi } from '../lib/api.js'
import { registerTodayCommand } from '../commands/today.js'

const mockGetApi = vi.mocked(getApi)

function createMockApi() {
  return {
    getTasks: vi.fn().mockResolvedValue({ results: [], nextCursor: null }),
    getProjects: vi.fn().mockResolvedValue({ results: [], nextCursor: null }),
  }
}

function createProgram() {
  const program = new Command()
  program.exitOverride()
  registerTodayCommand(program)
  return program
}

function getToday(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function getYesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('today command', () => {
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

  it('shows overdue tasks in Overdue section', async () => {
    const program = createProgram()

    mockApi.getTasks.mockResolvedValue({
      results: [
        { id: 'task-1', content: 'Overdue task', projectId: 'proj-1', due: { date: getYesterday(), string: 'yesterday' } },
      ],
      nextCursor: null,
    })
    mockApi.getProjects.mockResolvedValue({
      results: [{ id: 'proj-1', name: 'Work' }],
      nextCursor: null,
    })

    await program.parseAsync(['node', 'td', 'today'])

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Overdue'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Overdue task'))
  })

  it('shows tasks due today in Today section', async () => {
    const program = createProgram()

    mockApi.getTasks.mockResolvedValue({
      results: [
        { id: 'task-1', content: 'Today task', projectId: 'proj-1', due: { date: getToday(), string: 'today' } },
      ],
      nextCursor: null,
    })
    mockApi.getProjects.mockResolvedValue({
      results: [{ id: 'proj-1', name: 'Work' }],
      nextCursor: null,
    })

    await program.parseAsync(['node', 'td', 'today'])

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Today'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Today task'))
  })

  it('shows "No tasks due today" when empty', async () => {
    const program = createProgram()

    mockApi.getTasks.mockResolvedValue({ results: [], nextCursor: null })
    mockApi.getProjects.mockResolvedValue({ results: [], nextCursor: null })

    await program.parseAsync(['node', 'td', 'today'])

    expect(consoleSpy).toHaveBeenCalledWith('No tasks due today.')
  })

  it('excludes tasks with future due dates', async () => {
    const program = createProgram()

    mockApi.getTasks.mockResolvedValue({
      results: [
        { id: 'task-1', content: 'Future task', projectId: 'proj-1', due: { date: '2099-12-31', string: 'Dec 31' } },
      ],
      nextCursor: null,
    })
    mockApi.getProjects.mockResolvedValue({ results: [], nextCursor: null })

    await program.parseAsync(['node', 'td', 'today'])

    expect(consoleSpy).toHaveBeenCalledWith('No tasks due today.')
  })

  it('outputs JSON with --json flag', async () => {
    const program = createProgram()

    mockApi.getTasks.mockResolvedValue({
      results: [
        { id: 'task-1', content: 'Today task', projectId: 'proj-1', due: { date: getToday() } },
      ],
      nextCursor: null,
    })

    await program.parseAsync(['node', 'td', 'today', '--json'])

    const output = consoleSpy.mock.calls[0][0]
    const parsed = JSON.parse(output)
    expect(parsed.results).toBeDefined()
    expect(parsed.results[0].content).toBe('Today task')
  })

  it('outputs NDJSON with --ndjson flag', async () => {
    const program = createProgram()

    mockApi.getTasks.mockResolvedValue({
      results: [
        { id: 'task-1', content: 'Task 1', projectId: 'proj-1', due: { date: getToday() } },
        { id: 'task-2', content: 'Task 2', projectId: 'proj-1', due: { date: getYesterday() } },
      ],
      nextCursor: null,
    })

    await program.parseAsync(['node', 'td', 'today', '--ndjson'])

    const output = consoleSpy.mock.calls[0][0]
    const lines = output.split('\n')
    expect(lines).toHaveLength(2)
  })

  it('includes project names in output', async () => {
    const program = createProgram()

    mockApi.getTasks.mockResolvedValue({
      results: [
        { id: 'task-1', content: 'Task', projectId: 'proj-1', due: { date: getToday() } },
      ],
      nextCursor: null,
    })
    mockApi.getProjects.mockResolvedValue({
      results: [{ id: 'proj-1', name: 'Work' }],
      nextCursor: null,
    })

    await program.parseAsync(['node', 'td', 'today'])

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Work'))
  })
})
