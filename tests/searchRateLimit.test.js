import request from "supertest";
import app from "../app.js";

describe("Username lookup throttling", () => {
    test("searchUser endpoint rate limits rapid repeated requests", async () => {
        const results = [];

        for (let i = 0; i < 7; i += 1) {
            // No auth token is provided intentionally; limiter runs before userAuth.
            const res = await request(app).get("/searchUser").query({ searchQuery: "li" });
            results.push(res.status);
        }

        expect(results).toContain(429);
    });
});
