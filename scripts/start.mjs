import { spawn } from 'node:child_process'

const production = process.env.NODE_ENV === 'production'
const args = production ? ['run', 'start:prod'] : ['run', 'dev']
const npmCli = process.env.npm_execpath

if (!npmCli) {
  console.error('Run this command through npm: npm start')
  process.exit(1)
}

const child = spawn(process.execPath, [npmCli, ...args], { stdio: 'inherit' })

child.on('error', error => {
  console.error(`Could not start ${production ? 'the production server' : 'the development app'}:`, error.message)
  process.exitCode = 1
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exitCode = code ?? 1
})

