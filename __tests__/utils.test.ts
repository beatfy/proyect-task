import { cn, cuid } from "@/lib/utils";

describe("cn (className merger)", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "active")).toBe("base active");
  });

  it("deduplicates tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});

describe("cuid", () => {
  it("returns a string", () => {
    expect(typeof cuid()).toBe("string");
  });

  it("returns unique values", () => {
    const a = cuid();
    const b = cuid();
    expect(a).not.toBe(b);
  });

  it("returns a UUID-like string (36 chars with dashes)", () => {
    const id = cuid();
    expect(id).toHaveLength(36);
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});
