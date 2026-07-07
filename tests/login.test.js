import request from "supertest";
import app from "../app.js";

const hasAdminCreds = Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);

describe("POST /login", () => {
    const testWithAdminCreds = hasAdminCreds ? test : test.skip;

    testWithAdminCreds("correct credentials return 200 and an MFA challenge token", async () => {
        const res = await request(app)
            .post("/login")
            .send({ username: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("mfaToken");
        expect(res.body).toHaveProperty("requires2FA", true);
        expect(res.body).not.toHaveProperty("token");
        expect(res.body).toHaveProperty("user");
    });

    testWithAdminCreds("wrong password returns 400", async () => {
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