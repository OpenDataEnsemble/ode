/**
 * @see https://prettier.io/docs/configuration
 * Uses .cjs so Prettier receives plain config (avoids ESM default-export wrapper warnings)
 */
module.exports = {
  arrowParens: 'avoid',
  bracketSameLine: true,
  bracketSpacing: true,
  singleQuote: true,
  trailingComma: 'all',
};
