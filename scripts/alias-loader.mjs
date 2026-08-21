/**
 * Module resolver for the verification scripts.
 *
 * They import application code with the same `@/...` aliases the app uses, which
 * Node cannot resolve on its own. This hook maps `@/` to the project root, adds
 * the `.ts` extension Node's type-stripping needs, and resolves bare packages
 * from the project's own `node_modules`.
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PROJECT_ROOT = new URL('../', import.meta.url);
const requireFromProject = createRequire(new URL('package.json', PROJECT_ROOT));

export function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    let url = new URL(specifier.slice(2), PROJECT_ROOT).href;
    if (!existsSync(fileURLToPath(url))) {
      for (const extension of ['.ts', '.tsx', '/index.ts']) {
        if (existsSync(fileURLToPath(url + extension))) {
          url += extension;
          break;
        }
      }
    }
    return next(url, context);
  }

  if (!/^[./]/.test(specifier) && !specifier.startsWith('node:')) {
    try {
      return next(pathToFileURL(requireFromProject.resolve(specifier)).href, context);
    } catch {
      // Not a project dependency — fall through to Node's default resolution.
    }
  }

  return next(specifier, context);
}
