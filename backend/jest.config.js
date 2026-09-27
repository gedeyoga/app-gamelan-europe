/** @type {import('jest').Config} */
// `sanitize-html` (via `htmlparser2@12`) ships ESM-only deps; Node 22 `require(esm)`
// handles them at runtime, but Jest's CJS runtime needs them transpiled. ts-jest
// compiles the affected ESM packages (allowJs) while the rest of node_modules is skipped.
const esmDeps =
  'htmlparser2|domhandler|domutils|dom-serializer|domelementtype|entities|leac|parseley|selderee';

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/libs', '<rootDir>/apps'],
  moduleNameMapper: {
    '^@app/libs/(.*)$': '<rootDir>/libs/src/$1',
    '^@app/libs$': '<rootDir>/libs/src/index',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest'],
    '^.+\\.js$': [
      'ts-jest',
      {
        diagnostics: false,
        tsconfig: { allowJs: true, module: 'commonjs', target: 'ES2021', esModuleInterop: true },
      },
    ],
  },
  // `.pnpm` is allowed through so the inner `node_modules/<pkg>` can be checked.
  transformIgnorePatterns: [`/node_modules/(?!(\\.pnpm|${esmDeps})/)`],
};
