import {
  TodoistApi,
  Task,
  PersonalProject,
  WorkspaceProject,
  Section,
  User,
} from '@doist/todoist-api-typescript'
import { getApiToken } from '../auth.js'

let apiClient: TodoistApi | null = null

export async function getApi(): Promise<TodoistApi> {
  if (!apiClient) {
    const token = await getApiToken()
    apiClient = new TodoistApi(token)
  }
  return apiClient
}

export type Project = PersonalProject | WorkspaceProject

export function isWorkspaceProject(
  project: Project
): project is WorkspaceProject {
  return 'workspaceId' in project && project.workspaceId !== undefined
}

export function isPersonalProject(
  project: Project
): project is PersonalProject {
  return !isWorkspaceProject(project)
}

let currentUserIdCache: string | null = null

export async function getCurrentUserId(): Promise<string> {
  if (currentUserIdCache) return currentUserIdCache
  const api = await getApi()
  const user = await api.getUser()
  currentUserIdCache = user.id
  return currentUserIdCache
}

export function clearCurrentUserCache(): void {
  currentUserIdCache = null
}

export interface SyncCommand {
  type: string
  uuid: string
  temp_id?: string
  args: Record<string, unknown>
}

export interface SyncResponse {
  sync_status?: Record<string, string | { error_code: number; error: string }>
  temp_id_mapping?: Record<string, string>
  reminders?: Array<Record<string, unknown>>
  user?: Record<string, unknown>
  user_settings?: Record<string, unknown>
  error?: string
  error_code?: number
}

export function generateUuid(): string {
  return crypto.randomUUID()
}

export async function executeSyncCommand(
  commands: SyncCommand[]
): Promise<SyncResponse> {
  const token = await getApiToken()
  const response = await fetch('https://api.todoist.com/api/v1/sync', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      commands: JSON.stringify(commands),
    }),
  })

  if (!response.ok) {
    throw new Error(`Sync API error: ${response.status}`)
  }

  const data: SyncResponse = await response.json()
  if (data.error) {
    throw new Error(`Sync API error: ${data.error}`)
  }

  for (const cmd of commands) {
    const status = data.sync_status?.[cmd.uuid]
    if (status && typeof status === 'object' && 'error' in status) {
      throw new Error(status.error)
    }
  }

  return data
}

export interface NotificationSyncResponse {
  live_notifications?: Array<Record<string, unknown>>
  live_notifications_last_read_id?: number
  sync_status?: Record<string, string | { error_code: number; error: string }>
  error?: string
}

export async function executeSyncV9Command(
  commands: SyncCommand[]
): Promise<NotificationSyncResponse> {
  const token = await getApiToken()
  const response = await fetch('https://api.todoist.com/sync/v9/sync', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      commands: JSON.stringify(commands),
    }),
  })

  if (!response.ok) {
    throw new Error(`Sync API error: ${response.status}`)
  }

  const data: NotificationSyncResponse = await response.json()
  if (data.error) {
    throw new Error(`Sync API error: ${data.error}`)
  }

  for (const cmd of commands) {
    const status = data.sync_status?.[cmd.uuid]
    if (status && typeof status === 'object' && 'error' in status) {
      throw new Error(status.error)
    }
  }

  return data
}

export async function completeTaskForever(taskId: string): Promise<void> {
  const command: SyncCommand = {
    type: 'item_complete',
    uuid: generateUuid(),
    args: { id: taskId },
  }
  await executeSyncCommand([command])
}

export type { Task, PersonalProject, WorkspaceProject, Section, User }
