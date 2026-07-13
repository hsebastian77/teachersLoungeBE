import request from "supertest";
import app from "../app.js";

describe("Password reset endpoints", () => {
    test("POST /password-reset/request returns 400 when email is missing", async () => {
        const res = await request(app)
            .post("/password-reset/request")
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.message).toBe("Email is required");
    });

    test("POST /password-reset/confirm returns 400 when reset credential/new password are missing", async () => {
        const res = await request(app)
            .post("/password-reset/confirm")
            .send({ email: "test@example.com" });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe("Reset code (or token) and new password are required");
    });

    test("POST /password-reset/confirm returns 400 for invalid reset code format", async () => {
        const res = await request(app)
            .post("/password-reset/confirm")
            .send({ email: "test@example.com", code: "12ab", newPassword: "password123" });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe("Reset code must be 6 digits");
    });

    test("POST /password-reset/confirm returns 400 for short password", async () => {
        const res = await request(app)
            .post("/password-reset/confirm")
            .send({ token: "abc123", newPassword: "short" });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe("Password must be at least 8 characters long");
    });
});
