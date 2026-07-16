import { inferAttachmentType, isHttpUrl, normalizePostAttachment } from "../utils/postInput.js";

describe("Post attachment normalization", () => {
    test("returns null attachment fields when fileUrl is empty", () => {
        const result = normalizePostAttachment({ fileUrl: "  " });

        expect(result).toEqual({
            fileUrl: null,
            fileDisplayName: null,
            fileType: null,
        });
    });

    test("accepts http/https URLs", () => {
        expect(isHttpUrl("https://example.com/file.png")).toBe(true);
        expect(isHttpUrl("http://example.com/file.png")).toBe(true);
        expect(isHttpUrl("ftp://example.com/file.png")).toBe(false);
    });

    test("infers image attachment type from extension", () => {
        expect(inferAttachmentType("https://example.com/photo.jpg")).toBe("Image");
        expect(inferAttachmentType("https://example.com/archive.pdf")).toBe("Link");
    });

    test("normalizes URL and derives display name/type", () => {
        const result = normalizePostAttachment({
            fileUrl: "https://example.com/uploads/my%20pic.png",
            fileDisplayName: "",
            fileType: "",
        });

        expect(result.fileUrl).toBe("https://example.com/uploads/my%20pic.png");
        expect(result.fileDisplayName).toBe("my pic.png");
        expect(result.fileType).toBe("Image");
    });

    test("throws for non-http URL", () => {
        expect(() =>
            normalizePostAttachment({ fileUrl: "javascript:alert(1)" })
        ).toThrow("Invalid fileUrl. Only http/https links are allowed");
    });
});
