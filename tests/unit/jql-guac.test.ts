import { describe, it, expect } from "vitest";
import { parse, compile, compileOrder, EqlError } from "@/lib/jql";
import { encode, splitInstructions } from "@/lib/tech/guac";

describe("EQL query language", () => {
  it("parses precedence, IN, IS EMPTY and ORDER BY", () => {
    const p = parse(`project = MBM AND (priority IN (High, Blocker) OR showstopper = true) AND assignee IS NOT EMPTY ORDER BY priority DESC, created`);
    expect(p.where?.k).toBe("and"); expect(p.orderBy).toEqual([{ field: "priority", dir: "desc" }, { field: "created", dir: "asc" }]);
  });
  it("compiles currentUser() and negation to a Prisma filter", () => {
    const w = compile(parse("assignee = currentUser() AND NOT status = Done").where, { userId: "u-1" });
    expect(JSON.stringify(w)).toContain("u-1"); expect(JSON.stringify(w)).toContain("NOT");
  });
  it("rejects malformed queries with a clear error", () => {
    expect(() => parse('summary ~ "open')).toThrow(EqlError);
    expect(() => parse("project = ")).toThrow(EqlError);
    expect(() => parse("ORDER priority")).toThrow(/BY/);
    expect(() => compileOrder([{ field: "password", dir: "asc" }])).toThrow(EqlError);
  });
});

describe("Guacamole protocol framing", () => {
  it("encodes with code-point lengths", () => { expect(encode("select", "rdp")).toBe("6.select,3.rdp;"); expect(encode("ب")).toBe("1.ب;"); });
  it("splits complete instructions and keeps the partial remainder", () => {
    const [ins, rest, raw] = splitInstructions("4.sync,3.123;5.mouse,1.1,1.2;4.si");
    expect(ins).toEqual([["sync", "123"], ["mouse", "1", "2"]]); expect(rest).toBe("4.si"); expect(raw).toEqual(["4.sync,3.123;", "5.mouse,1.1,1.2;"]);
  });
  it("handles astral characters and rejects garbage", () => {
    expect(splitInstructions("2.😀x;")[0]).toEqual([["😀x"]]);
    expect(() => splitInstructions("x.abc;")).toThrow();
  });
});
