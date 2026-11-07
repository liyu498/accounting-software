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

function waitForExit(child, timeoutMs = 5_000) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true)

  return new Promise((resolve) => {
    let settled = false
    const finish = (exited) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      child.off('exit', onExit)
      child.off('error', onExit)
      resolve(exited)
    }
    const onExit = () => finish(true)
    const timeout = setTimeout(() => finish(false), timeoutMs)
    timeout.unref?.()
    child.once('exit', onExit)
    child.once('error', onExit)
  })
}

export async function stopProcessTree(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null || !child.pid) return

  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      })
      killer.once('error', () => {
        child.kill()
        resolve()
      })
      killer.once('exit', resolve)
    })
    await waitForExit(child)
    return
  }

  child.kill('SIGTERM')
  if (!(await waitForExit(child))) {
    child.kill('SIGKILL')
    await waitForExit(child)
  }
}
