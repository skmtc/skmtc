// Custom Node.js implementation for @std/fs functionality
import { promises as fs } from 'node:fs'
import path from 'node:path'

// Implementation for move functionality that @std/fs uses
export async function move(src: string, dest: string, options?: { overwrite?: boolean }) {
  try {
    // Try simple rename first (works if on same filesystem)
    await fs.rename(src, dest)
  } catch (error) {
    // If rename fails, fall back to copy + remove
    if ((error as NodeJS.ErrnoException).code === 'EXDEV') {
      await copyFile(src, dest)
      await fs.rm(src, { recursive: true, force: true })
    } else {
      throw error
    }
  }
}

export function moveSync(src: string, dest: string, options?: { overwrite?: boolean }) {
  const fs = require('node:fs')
  try {
    fs.renameSync(src, dest)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EXDEV') {
      copyFileSync(src, dest)
      fs.rmSync(src, { recursive: true, force: true })
    } else {
      throw error
    }
  }
}

async function copyFile(src: string, dest: string) {
  const stat = await fs.stat(src)
  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true })
    const entries = await fs.readdir(src)
    for (const entry of entries) {
      await copyFile(path.join(src, entry), path.join(dest, entry))
    }
  } else {
    await fs.copyFile(src, dest)
  }
}

function copyFileSync(src: string, dest: string) {
  const fs = require('node:fs')
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true })
    const entries = fs.readdirSync(src)
    for (const entry of entries) {
      copyFileSync(path.join(src, entry), path.join(dest, entry))
    }
  } else {
    fs.copyFileSync(src, dest)
  }
}

// Export the NotSupported error as a placeholder that shouldn't be called
export class NotSupported extends Error {
  constructor(message: string) {
    super(`This operation is not supported in Node.js: ${message}`)
    this.name = 'NotSupported'
  }
}
