// `server-only` throws when Node resolves its client build. This stub replaces
// it for scripts run outside Next (see scripts/tsconfig.e2e.json). It exists
// only so the E2E script can import real server modules.
export {};
