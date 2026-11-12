/*
  A PreToolUse hook: the project's code is read, written and edited only through Serena (serena_repl), never with the
  built-in Read/Write/Edit tools or shell commands that read or write files. A call that would do so is denied (exit code 2),
  and the reason, naming the Serena function to use instead, goes back to Claude. Everything else passes.
  Input: the hook's JSON on stdin ({ tool_name, tool_input }). Run with Bun
*/

/** What a PreToolUse hook receives, as far as this guard needs it */
type HookInput = { tool_name: string, tool_input: { file_path?: string, command?: string } }

/** The project's code: under these folders, with these extensions */
const CODE_FOLDERS = [ `frontend/src/`, `frontend/translations/`, `backend/src/` ]
const CODE_FILE = /\.(ts|js|svelte|astro|css|ya?ml)$/

/**
 * A shell command reading or writing a code file: a reader or editor given a code file in the same step of a pipe, or a
 * redirect into one. Output piped into `tail` or redirected with `2>&1` passes
 */
const SHELL_READER = String.raw`\b(cat|head|tail|sed|awk|tee|perl|python3?|Get-Content|Set-Content|Add-Content|Out-File)\b[^|;&]*`
const SHELL_REDIRECT = String.raw`>>?\s*["']?`
const CODE_PATH = String.raw`[^\s"'|;&>]*(src|translations)[\\/][^\s"'|;&]*\.(ts|js|svelte|astro|css|ya?ml)\b`
const CODE_NAME = String.raw`[^\s"'|;&>]*\.(ts|js|svelte|astro|css|ya?ml)\b`

/** After a `cd` into the code's folders, a bare file name is a code file too */
const CD_INTO_CODE = /\bcd\s+["']?[^\s;&|]*(src|translations)\b/

const SERENA_HINT = {
  Read: `s.lsp.get_symbols_overview / s.lsp.find_symbol( include_body=True ) or s.fs.read_file`,
  Write: `s.fs.create_text_file (a new file) or s.edit.* (an existing one)`,
  Edit: `s.edit.replace_content / s.edit.replace_symbol_body (s.edit.replace_in_files for the same change in many files)`,
  Bash: `serena_repl (s.fs.read_file, s.fs.search_for_pattern, s.edit.*); the shell only runs tools (bun run, git, mv)`,
} as const

const input = await Bun.stdin.json() as HookInput
const reason = findViolation( input )

if (reason) {
  console.error( reason )
  process.exit( 2 )
}

/** Why the call is denied, or null when it may run */
function findViolation({ tool_name:toolName, tool_input:toolInput }:HookInput) {
  const tool = toolName === `PowerShell` ? `Bash` : toolName

  if (tool === `Read` || tool === `Write` || tool === `Edit`) {
    const path = toolInput.file_path?.replaceAll( `\\`, `/` ) ?? ``
    if (!isCodeFile( path )) return null

    return `Code files of this project go through Serena: use ${SERENA_HINT[ tool ]} instead of ${toolName} (${path}).`
  }

  if (tool !== `Bash`) return null

  const command = toolInput.command ?? ``
  const codeFile = CD_INTO_CODE.test( command ) ? CODE_NAME : CODE_PATH
  const isFileAccess = [ SHELL_READER, SHELL_REDIRECT ].some( prefix => new RegExp( prefix + codeFile ).test( command ) )
  if (!isFileAccess) return null

  return `This command reads or writes code files; use ${SERENA_HINT.Bash}.`
}

function isCodeFile( path:string ) {
  return CODE_FILE.test( path ) && CODE_FOLDERS.some( folder => path.includes( `/${folder}` ) || path.startsWith( folder ) )
}
