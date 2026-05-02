// Make a Claude-generated TSX string safe to eval inside an inline
// <script type="text/babel"> block: strip ESM imports/exports, drop TS-only
// declarations that collide with our injected globals, and normalise the
// default export so we can look the symbol up by name at runtime.

export function stripCodeFences(text: string): string {
  let out = text.trim();
  if (out.startsWith("```")) {
    const firstNewline = out.indexOf("\n");
    if (firstNewline !== -1) out = out.slice(firstNewline + 1);
    if (out.endsWith("```")) out = out.slice(0, -3);
  }
  return out.trim();
}

export function sanitiseForBabel(tsx: string): string {
  let out = tsx;

  out = out.replace(/^\s*import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, "");
  out = out.replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, "");

  out = out.replace(/export\s+default\s+function\s+/g, "function ");
  out = out.replace(/^\s*export\s+default\s+\w+\s*;?\s*$/gm, "");
  out = out.replace(/^\s*export\s+(const|function|let|var)\s+/gm, "$1 ");
  out = out.replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, "");

  out = out.replace(/^\s*interface\s+\w+[\s\S]*?\n\}\s*$/gm, "");
  out = out.replace(/^\s*type\s+\w+\s*=\s*[\s\S]*?;\s*$/gm, "");

  return out.trim();
}
