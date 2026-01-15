import { Command } from 'commander'
import { saveApiToken } from '../lib/auth.js'
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
} from '../lib/pkce.js'
import { startCallbackServer } from '../lib/oauth-server.js'
import { buildAuthorizationUrl, exchangeCodeForToken } from '../lib/oauth.js'
import chalk from 'chalk'
import open from 'open'

async function loginWithToken(token: string): Promise<void> {
  await saveApiToken(token.trim())
  console.log(chalk.green('✓'), 'API token saved successfully!')
  console.log(chalk.dim('Token saved to ~/.config/todoist-cli/config.json'))
}

async function loginWithOAuth(): Promise<void> {
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)
  const state = generateState()

  console.log('Opening browser for Todoist authorization...')

  const authUrl = buildAuthorizationUrl(codeChallenge, state)
  const callbackPromise = startCallbackServer(state)

  await open(authUrl)
  console.log(chalk.dim('Waiting for authorization...'))

  const code = await callbackPromise
  console.log(chalk.dim('Exchanging code for token...'))

  const accessToken = await exchangeCodeForToken(code, codeVerifier)
  await saveApiToken(accessToken)

  console.log(chalk.green('✓'), 'Successfully logged in!')
  console.log(chalk.dim('Token saved to ~/.config/todoist-cli/config.json'))
}

export function registerLoginCommand(program: Command): void {
  const login = program
    .command('login')
    .description('Authenticate with Todoist')
    .action(loginWithOAuth)

  login
    .command('token <token>')
    .description('Save API token to config file (manual authentication)')
    .action(loginWithToken)
}
