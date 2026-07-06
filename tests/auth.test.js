import request from "supertest";
import app from "../app.js";

test("All userAuth protected routes reject unauthenticated requests", async () => {
    const routes = [];

    app._router.stack.forEach(layer => {
        // Top level routes
        if (layer.route) {
            const hasAuth = layer.route.stack.some(h => h.name === "userAuth");
            if (hasAuth) {
                Object.keys(layer.route.methods).forEach(method => {
                    routes.push({ method, path: layer.route.path });
                });
            }
        }
        // Router middleware layer (app.use(router))
        if (layer.name === "router" && layer.handle.stack) {
            layer.handle.stack.forEach(inner => {
                if (inner.route) {
                    const hasAuth = inner.route.stack.some(h => h.name === "userAuth");
                    if (hasAuth) {
                        Object.keys(inner.route.methods).forEach(method => {
                            routes.push({ method, path: inner.route.path });
                        });
                    }
                }
            });
        }
    });

    expect(routes.length).toBeGreaterThan(0);

    for (const { method, path } of routes) {
        const resolvedPath = path.replace(/:[\w]+/g, "test");
        const res = await request(app)[method](resolvedPath);
        expect(res.status).toBe(401);
    }
});