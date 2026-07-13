#!/usr/bin/env node
import { execFileSync, spawnSync } from "child_process"
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

function getFormattedDiff(file: string, tmpFile: string): string | null {
  let formatted: string
  try {
    formatted = run("npx", ["prettier", file])
  } catch {
    console.error(`Skipping ${file} — prettier failed to format it.`)
    return null
  }

  fs.writeFileSync(tmpFile, formatted)

  try {
    // No diff — exits 0, stdout is empty
    return run("git", ["diff", "--no-index", "--color=always", "--", file, tmpFile])
  } catch (err) {
    // git diff --no-index exits 1 when there are differences — expected, not an error.
    // The diff text is on stdout of the thrown error.
    const stdout = (err as { stdout?: Buffer | string }).stdout
    return stdout ? stdout.toString() : ""
  }
}

function showInPager(text: string): void {
  if (!text.trim()) {
    console.log("No formatting differences found.")
    return
  }

  const [pagerCmd, ...pagerArgs] = (process.env.PAGER || "less -R").split(" ")

  const result = spawnSync(pagerCmd, pagerArgs, {
    input: text,
    stdio: ["pipe", "inherit", "inherit"],
  })

  if (result.error) {
    // Fall back to plain stdout if no pager is available
    process.stdout.write(text)
  }
}

function main(): void {
  const files = getChangedFiles()

  if (files.length === 0) {
    console.log("No formatting differences found.")
    return
  }

  const tmpFile = path.join(os.tmpdir(), "pf-diff-tmp")
  const diffs: string[] = []

  for (const file of files) {
    const diff = getFormattedDiff(file, tmpFile)
    if (diff) {
      diffs.push(diff)
    }
  }

  showInPager(diffs.join(""))
}

main()
