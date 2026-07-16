import request from "supertest";
import app from "../app.js";

describe("Auth header validation", () => {
    test("GET /getUserInfo returns 401 without Authorization header", async () => {
        const res = await request(app).get("/getUserInfo");
        expect(res.status).toBe(401);
        expect(res.body.message).toBe("Unauthorized request");
    });

    test("GET /getUserInfo returns 401 when Authorization is not Bearer", async () => {
        const res = await request(app)
            .get("/getUserInfo")
            .set("Authorization", "Token abc123");

        expect(res.status).toBe(401);
        expect(res.body.message).toBe("Unauthorized request");
    });

    test("GET /getUserInfo returns 401 for malformed Bearer token", async () => {
        const res = await request(app)
            .get("/getUserInfo")
            .set("Authorization", "Bearer not-a-valid-jwt");

        expect(res.status).toBe(401);
        expect(res.body.message).toBe("Invalid token");
    });
});
