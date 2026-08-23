declare module 'cloudflare:test' {
	// Gives the test-only `env` the same shape as the worker's bindings.
	interface ProvidedEnv extends Env {}
}
