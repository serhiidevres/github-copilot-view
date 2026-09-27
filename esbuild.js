const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');

async function build() {
  const buildContext = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    external: ['vscode'],
    format: 'cjs',
    minify: !watch,
    outfile: 'dist/extension.js',
    platform: 'node',
    sourcemap: true,
    target: 'node20'
  });

  if (watch) {
    await buildContext.watch();
    return;
  }

  await buildContext.rebuild();
  await buildContext.dispose();
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});