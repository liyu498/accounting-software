import { spawn } from 'node:child_process'

export function spawnNpm(args, options = {}) {
  const npmExecPath = process.env.npm_execpath
  if (npmExecPath) {
    return spawn(process.execPath, [npmExecPath, ...args], options)
  }

  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  return spawn(command, args, {
    ...options,
    shell: process.platform === 'win32',
  })
}
