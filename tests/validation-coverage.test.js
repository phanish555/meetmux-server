// Walks every registered Express route and asserts each one either
// exists in the EXEMPT list or has the `validate` middleware attached.
// Adding an unvalidated route fails CI.

const app = require('../src/app');

// The walker strips the '/api/v1' mount prefix — match the paths as it sees them.
// Every entry MUST be justified.
const EXEMPT = new Set([
  'GET /health',           // no input
  'GET /ready',            // no input
  'POST /auth/logout-all', // auth-only, no body
  'GET /auth/me',          // auth-only, no input
]);

function listRoutes(expressApp) {
  const routes = [];
  const walk = (stack, prefix = '') => {
    for (const layer of stack) {
      if (layer.route) {
        for (const [method] of Object.entries(layer.route.methods || {})) {
          const routeStack = layer.route.stack || [];
          routes.push({
            key: `${method.toUpperCase()} ${prefix}${layer.route.path}`,
            handlers: routeStack.map((s) => s.name || 'anonymous'),
          });
        }
      } else if (layer.name === 'router' && layer.handle?.stack) {
        // Extract mount prefix from the layer's regexp
        const src = layer.regexp?.source || '';
        const mount = src
          .replace('^\\/', '/')
          .replace('\\/?(?=\\/|$)', '')
          .replace(/\\\//g, '/')
          .replace(/\?\(\?=.*$/, '')
          .replace(/\$$/, '');
        walk(layer.handle.stack, prefix + (mount === '/^' ? '' : mount));
      } else if (layer.handle?.stack) {
        walk(layer.handle.stack, prefix);
      }
    }
  };
  const stack = expressApp._router?.stack || expressApp.router?.stack;
  if (stack) walk(stack);
  return routes;
}

describe('validation coverage', () => {
  const routes = listRoutes(app);

  test('discovered at least a dozen routes (safety check)', () => {
    expect(routes.length).toBeGreaterThan(12);
  });

  test('every non-EXEMPT route has validate() middleware', () => {
    const missing = routes
      .filter((r) => !EXEMPT.has(r.key))
      .filter((r) => !r.handlers.some((h) => h === 'validate'))
      .map((r) => r.key);

    expect(missing).toEqual([]);
  });

  test('every route with a path param has validate() middleware (nothing else can check ID shape)', () => {
    const missing = routes
      .filter((r) => r.key.includes('/:'))
      .filter((r) => !r.handlers.some((h) => h === 'validate'))
      .map((r) => r.key);

    expect(missing).toEqual([]);
  });
});
