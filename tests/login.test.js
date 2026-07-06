import request from "supertest";
import app from "../app.js";

describe("POST /login", () => {
    test("correct credentials return 200 and a token", async () => {
        const res = await request(app)
            .post("/login")
            .send({ username: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("token");
        expect(res.body).toHaveProperty("user");
    });

    test("wrong password returns 400", async () => {
        const res = await request(app)
            .post("/login")
            .send({ username: process.env.ADMIN_EMAIL, password: "wrongpassword" });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe("Incorrect password");
    });

    test("nonexistent email returns 400", async () => {
        const res = await request(app)
            .post("/login")
            .send({ username: "nobody@fake.com", password: "password123" });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe("User doesn't exist");
    });

    test("missing fields return 400", async () => {
        const res = await request(app)
            .post("/login")
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toBe("Email and password are required");
    });
});