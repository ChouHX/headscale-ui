import { describe, expect, test } from "bun:test";
import {
  coverageRecords,
  sourceCategory,
  validateCoverage,
  validateTypeOnlySource,
} from "./check-unit-coverage";

const covered = `SF:src/example.ts
FNF:1
FNH:1
LF:2
LH:2
end_of_record
`;

describe("unit coverage gate", () => {
  test("accepts a complete non-empty record", () => {
    expect(validateCoverage(["src/example.ts"], coverageRecords(covered))).toEqual([]);
  });

  test("rejects an empty denominator and zero-line records", () => {
    expect(validateCoverage([], new Map())).toContain("No business source files found");
    expect(
      validateCoverage(
        ["src/empty.ts"],
        coverageRecords("SF:src/empty.ts\nFNF:0\nFNH:0\nLF:0\nLH:0\nend_of_record\n"),
      ),
    ).toContain("Empty coverage record: src/empty.ts");
  });

  test("rejects missing, incomplete, malformed, and duplicate records", () => {
    expect(validateCoverage(["src/missing.ts"], coverageRecords(covered))).toContain(
      "Missing from unit coverage: src/missing.ts",
    );
    expect(
      validateCoverage(
        ["src/example.ts"],
        coverageRecords("SF:src/example.ts\nFNF:1\nFNH:0\nLF:2\nLH:1\nend_of_record\n"),
      ),
    ).toContain("Below 100% unit coverage: src/example.ts: functions 0/1, lines 1/2");
    expect(() =>
      coverageRecords("SF:src/example.ts\nFNF:nope\nFNH:1\nLF:2\nLH:2\nend_of_record\n"),
    ).toThrow("Invalid FNF for src/example.ts");
    expect(() =>
      coverageRecords("SF:src/example.ts\nFNF:\nFNH:0\nLF:2\nLH:2\nend_of_record\n"),
    ).toThrow("Invalid FNF for src/example.ts");
    expect(() => coverageRecords(covered + covered)).toThrow(
      "Duplicate LCOV record: src/example.ts",
    );
  });

  test("classifies every source path and validates type-only exceptions", () => {
    expect(sourceCategory("src/composables/useProfiles.ts")).toBe("business");
    expect(sourceCategory("src/components/create-auth-key-dialog.ts")).toBe("business");
    expect(sourceCategory("src/api/types.ts")).toBe("type-only");
    expect(sourceCategory("src/i18n/catalog.ts")).toBe("type-only");
    expect(sourceCategory("src/composables/__testing.ts")).toBe("test-support");
    expect(sourceCategory("src/components/ui/table/utils.ts")).toBe("presentation");
    expect(sourceCategory("src/router/index.ts")).toBe("presentation");
    expect(sourceCategory("src/main.ts")).toBe("bootstrap");
    expect(sourceCategory("src/new-runtime.ts")).toBe("unclassified");
    expect(validateTypeOnlySource("export interface Value { id: string }\n")).toBe(true);
    expect(validateTypeOnlySource("export const value = 1;\n")).toBe(false);
  });
});
