#!/usr/bin/env node
import { execFileSync } from "child_process"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

function run(
  cmd: string,
  args: string[],
  options: Parameters<typeof execFileSync>[2] = {},
): string {
  return execFileSync(cmd, args, { encoding: "utf8", ...options }) as string
}

function getChangedFiles(): string[] {
  let listOutput: string
  try {
    listOutput = run("npx", ["prettier", "--list-different", "src"])
  } catch (err) {
    // prettier --list-different exits 1 when it finds files to list — that's expected,
    // the file list is still on stdout
    const stdout = (err as { stdout?: Buffer | string }).stdout
    listOutput = stdout ? stdout.toString() : ""
  }

  return listOutput
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean)
}

function diffFormatted(file: string, tmpFile: string): void {
  let formatted: string
  try {
    formatted = run("npx", ["prettier", file])
  } catch {
    console.error(`Skipping ${file} — prettier failed to format it.`)
    return
  }

  fs.writeFileSync(tmpFile, formatted)

  try {
    run("git", ["diff", "--no-index", "--", file, tmpFile], { stdio: "inherit" })
  } catch {
    // git diff --no-index exits 1 when there are differences — expected, not an error
  }
}

function main(): void {
  const files = getChangedFiles()

  if (files.length === 0) {
    console.log("No formatting differences found.")
    return
  }

  const tmpFile = path.join(os.tmpdir(), "pf-diff-tmp")

  for (const file of files) {
    diffFormatted(file, tmpFile)
  }
}

main()
