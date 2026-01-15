import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'

// Mock the auth module
vi.mock('../lib/auth.js', () => ({
  saveApiToken: vi.fn(),
}))

// Mock chalk to avoid colors in tests
vi.mock('chalk', () => ({
  default: {
    green: vi.fn((text) => text),
    dim: vi.fn((text) => text),
  },
}))

// Mock PKCE module
vi.mock('../lib/pkce.js', () => ({
  generateCodeVerifier: vi.fn(() => 'test_code_verifier'),
  generateCodeChallenge: vi.fn(() => 'test_code_challenge'),
  generateState: vi.fn(() => 'test_state'),
}))

// Mock OAuth server
vi.mock('../lib/oauth-server.js', () => ({
  startCallbackServer: vi.fn(),
  OAUTH_REDIRECT_URI: 'http://localhost:8765/callback',
}))

// Mock OAuth module
vi.mock('../lib/oauth.js', () => ({
  buildAuthorizationUrl: vi.fn(
    () => 'https://todoist.com/oauth/authorize?test=1'
  ),
  exchangeCodeForToken: vi.fn(),
}))

// Mock open module
vi.mock('open', () => ({
  default: vi.fn(),
}))

import { saveApiToken } from '../lib/auth.js'
import { startCallbackServer } from '../lib/oauth-server.js'
import { exchangeCodeForToken } from '../lib/oauth.js'
import { registerLoginCommand } from '../commands/login.js'
import open from 'open'

const mockSaveApiToken = vi.mocked(saveApiToken)
const mockStartCallbackServer = vi.mocked(startCallbackServer)
const mockExchangeCodeForToken = vi.mocked(exchangeCodeForToken)
const mockOpen = vi.mocked(open)

function createProgram() {
  const program = new Command()
  program.exitOverride()
  registerLoginCommand(program)
  return program
}

describe('login command', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  describe('token subcommand', () => {
    it('successfully saves a token', async () => {
      const program = createProgram()
      const token = 'some_token_123456789'

      mockSaveApiToken.mockResolvedValue(undefined)

      await program.parseAsync(['node', 'td', 'login', 'token', token])

      expect(mockSaveApiToken).toHaveBeenCalledWith(token)
      expect(consoleSpy).toHaveBeenCalledWith(
        '✓',
        'API token saved successfully!'
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        'Token saved to ~/.config/todoist-cli/config.json'
      )
    })

    it('handles saveApiToken errors', async () => {
      const program = createProgram()
      const token = 'some_token_123456789'

      mockSaveApiToken.mockRejectedValue(new Error('Permission denied'))

      await expect(
        program.parseAsync(['node', 'td', 'login', 'token', token])
      ).rejects.toThrow('Permission denied')

      expect(mockSaveApiToken).toHaveBeenCalledWith(token)
    })

    it('trims whitespace from token', async () => {
      const program = createProgram()
      const tokenWithWhitespace = '  some_token_123456789  '
      const expectedToken = 'some_token_123456789'

      mockSaveApiToken.mockResolvedValue(undefined)

      await program.parseAsync([
        'node',
        'td',
        'login',
        'token',
        tokenWithWhitespace,
      ])

      expect(mockSaveApiToken).toHaveBeenCalledWith(expectedToken)
    })
  })

  describe('OAuth flow', () => {
    it('completes OAuth flow successfully', async () => {
      const program = createProgram()
      const authCode = 'oauth_auth_code_123'
      const accessToken = 'oauth_access_token_456'

      mockStartCallbackServer.mockResolvedValue(authCode)
      mockExchangeCodeForToken.mockResolvedValue(accessToken)
      mockSaveApiToken.mockResolvedValue(undefined)
      mockOpen.mockResolvedValue({} as any)

      await program.parseAsync(['node', 'td', 'login'])

      expect(mockOpen).toHaveBeenCalledWith(
        'https://todoist.com/oauth/authorize?test=1'
      )
      expect(mockStartCallbackServer).toHaveBeenCalledWith('test_state')
      expect(mockExchangeCodeForToken).toHaveBeenCalledWith(
        authCode,
        'test_code_verifier'
      )
      expect(mockSaveApiToken).toHaveBeenCalledWith(accessToken)
      expect(consoleSpy).toHaveBeenCalledWith('✓', 'Successfully logged in!')
    })

    it('handles OAuth callback server error', async () => {
      const program = createProgram()

      mockStartCallbackServer.mockRejectedValue(
        new Error('OAuth callback timed out')
      )
      mockOpen.mockResolvedValue({} as any)

      await expect(program.parseAsync(['node', 'td', 'login'])).rejects.toThrow(
        'OAuth callback timed out'
      )

      expect(mockSaveApiToken).not.toHaveBeenCalled()
    })

    it('handles token exchange error', async () => {
      const program = createProgram()

      mockStartCallbackServer.mockResolvedValue('auth_code')
      mockExchangeCodeForToken.mockRejectedValue(
        new Error('Token exchange failed: 400')
      )
      mockOpen.mockResolvedValue({} as any)

      await expect(program.parseAsync(['node', 'td', 'login'])).rejects.toThrow(
        'Token exchange failed'
      )

      expect(mockSaveApiToken).not.toHaveBeenCalled()
    })
  })
})
