import request from "supertest";
import app from "../app.js";

test("GET /test", async () => {
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
});
