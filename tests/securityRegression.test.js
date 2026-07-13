import jwt from "jsonwebtoken";
import request from "supertest";
import app from "../app.js";

describe("Security regression checks", () => {
    test("DELETE /deleteComment/:commentId rejects unauthenticated requests", async () => {
        const res = await request(app).delete("/deleteComment/180");
        expect(res.status).toBe(401);
    });

    test("DELETE /deleteComment with query commentId rejects unauthenticated requests", async () => {
        const res = await request(app).delete("/deleteComment").query({ commentId: 180 });
        expect(res.status).toBe(401);
    });

    test("POST /password-reset/request returns generic success for unknown email", async () => {
        const res = await request(app)
            .post("/password-reset/request")
            .send({ email: "definitely-not-a-real-user@example.com" });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe("If an account with that email exists, a password reset link has been sent.");
    });

    test("POST /password-reset/confirm with code but no email returns 400", async () => {
        const res = await request(app)
            .post("/password-reset/confirm")
            .send({ code: "123456", newPassword: "password123" });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe("Email is required when using reset code");
    });

    const testWithJwtSecret = process.env.JWT_SECRET ? test : test.skip;

    testWithJwtSecret("Protected route rejects MFA preauth token", async () => {
        const preauthToken = jwt.sign(
            {
                email: "anyone@example.com",
                role: "Approved",
                tokenType: "preauth",
                challengeId: "test-challenge",
            },
            process.env.JWT_SECRET,
            { expiresIn: "10m" }
        );

        const res = await request(app)
            .get("/getUserInfo")
            .set("Authorization", `Bearer ${preauthToken}`);

        expect(res.status).toBe(401);
        expect(res.body.message).toBe("MFA verification required");
    });
});
