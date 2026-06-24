import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const projectRoot = process.cwd();

export function createAtdbScriptHarness(options = {}) {
  const tempPrefix = options.tempPrefix ?? 'geneotools-atdb-test-';
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), tempPrefix));
  const requireFromScript = createRequire(import.meta.url);

  function linkNodeModules() {
    const sourcePath = path.join(projectRoot, 'node_modules');
    const targetPath = path.join(tempDir, 'node_modules');

    try {
      fs.symlinkSync(sourcePath, targetPath, process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      throw new Error(`test harness node_modules link failed: ${safeErrorCode(error)}`);
    }
  }

  function compileTypeScriptFile(sourcePath, outputPath) {
    try {
      const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
        compilerOptions: {
          esModuleInterop: true,
          module: ts.ModuleKind.CommonJS,
          moduleResolution: ts.ModuleResolutionKind.NodeJs,
          resolveJsonModule: true,
          target: ts.ScriptTarget.ES2020,
        },
        fileName: path.basename(sourcePath),
      });

      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, compiled.outputText, 'utf8');
    } catch (error) {
      throw new Error(`test harness compile failed: ${safeErrorCode(error)}`);
    }
  }

  function compileTree(sourceDir, outputDir) {
    try {
      if (!fs.existsSync(sourceDir)) {
        return;
      }

      for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
        const sourcePath = path.join(sourceDir, entry.name);
        const outputPath = path.join(outputDir, entry.name);

        if (entry.isDirectory()) {
          compileTree(sourcePath, outputPath);
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
          compileTypeScriptFile(sourcePath, outputPath.replace(/\.ts$/, '.js'));
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          fs.mkdirSync(path.dirname(outputPath), { recursive: true });
          fs.copyFileSync(sourcePath, outputPath);
        }
      }
    } catch (error) {
      throw new Error(`test harness tree compile failed: ${safeErrorCode(error)}`);
    }
  }

  function compileLib() {
    linkNodeModules();
    compileTree(path.join(projectRoot, 'lib'), path.join(tempDir, 'lib'));
  }

  function requireCompiled(relativePath) {
    return requireFromScript(path.join(tempDir, relativePath));
  }

  function cleanup() {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }

  return {
    cleanup,
    compileLib,
    compileTree,
    requireCompiled,
    tempDir,
  };
}

export async function withAtdbScriptHarness(options, callback) {
  const harness = createAtdbScriptHarness(options);
  try {
    return await callback(harness);
  } finally {
    harness.cleanup();
  }
}

export async function withQuietProjectLogs(callback) {
  const originalWarn = console.warn;
  const originalError = console.error;
  console.warn = () => {};
  console.error = () => {};
  try {
    return await callback();
  } finally {
    console.warn = originalWarn;
    console.error = originalError;
  }
}

function safeErrorCode(error) {
  if (error && typeof error === 'object' && 'code' in error) {
    return String(error.code);
  }

  return error instanceof Error ? error.name : 'unknown';
}
