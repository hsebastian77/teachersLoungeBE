import request from "supertest";
import app from "../app.js";

describe("Password reset negative scenarios", () => {
    test("POST /password-reset/confirm returns 400 for invalid token", async () => {
        const res = await request(app)
            .post("/password-reset/confirm")
            .send({ token: "invalid-token", newPassword: "password123" });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe("Invalid or expired reset token");
    });

    test("POST /password-reset/confirm returns 400 for unknown email + valid code format", async () => {
        const res = await request(app)
            .post("/password-reset/confirm")
            .send({ email: "nobody@example.com", code: "123456", newPassword: "password123" });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe("Invalid or expired reset code");
    });

    test("POST /password-reset/request trims and accepts email input", async () => {
        const res = await request(app)
            .post("/password-reset/request")
            .send({ email: "  nobody@example.com  " });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe("If an account with that email exists, a password reset link has been sent.");
    });
});
