/** Portal version from package.json for x-formulus-version header. */
// Read version from package.json at build time
// For Vite, we use import.meta.env or a constant that matches package.json
// This will be replaced at build time or we can use a vite plugin
// For now, using a constant that should match package.json version
export const PORTAL_VERSION = '1.0.0';
