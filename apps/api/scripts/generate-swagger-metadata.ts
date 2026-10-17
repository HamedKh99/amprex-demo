/**
 * Writes src/metadata.ts: the @nestjs/swagger plugin's output (DTO properties, validation shims,
 * comments) as plain code. Vercel compiles src/main.ts itself rather than running `nest build`, so
 * the CLI plugin never runs there; main.ts loads this file instead. Re-run after changing DTOs.
 */
import { PluginMetadataGenerator } from '@nestjs/cli/lib/compiler/plugins/plugin-metadata-generator.js';
import { ReadonlyVisitor } from '@nestjs/swagger/plugin';
import { join } from 'node:path';

// The Nest CLI resolves tsconfigPath against the working directory.
process.chdir(join(import.meta.dirname, '..'));
const src = join(process.cwd(), 'src');

new PluginMetadataGenerator().generate({
  // Same options as the plugin in nest-cli.json.
  visitors: [new ReadonlyVisitor({ introspectComments: true, classValidatorShim: true, pathToSource: src })],
  outputDir: src,
  watch: false,
  tsconfigPath: 'tsconfig.build.json',
});
