import { relative, resolve } from "node:path";
import ts from "typescript";

const ROOT = resolve(import.meta.dir, "..");
const COVERAGE_FILE = resolve(ROOT, "coverage/lcov.info");
const BUSINESS_ROOTS = [
  "src/api",
  "src/composables",
  "src/domain",
  "src/i18n",
  "src/lib",
  "src/utils",
] as const;
const BUSINESS_FILES = new Set(["src/components/create-auth-key-dialog.ts"]);
const TYPE_ONLY_FILES = new Set(["src/api/types.ts", "src/i18n/catalog.ts"]);
const TEST_SUPPORT_FILES = new Set(["src/composables/__testing.ts"]);

export type SourceCategory =
  | "business"
  | "type-only"
  | "test-support"
  | "presentation"
  | "bootstrap"
  | "unclassified";

export function sourceCategory(path: string): SourceCategory {
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path) || TEST_SUPPORT_FILES.has(path)) {
    return "test-support";
  }
  if (TYPE_ONLY_FILES.has(path)) return "type-only";
  if (
    BUSINESS_FILES.has(path) ||
    BUSINESS_ROOTS.some((sourceRoot) => path.startsWith(`${sourceRoot}/`))
  ) {
    return "business";
  }
  if (
    path.startsWith("src/components/ui/") ||
    path.startsWith("src/pages/") ||
    path.startsWith("src/router/")
  ) {
    return "presentation";
  }
  if (path === "src/main.ts") return "bootstrap";
  return "unclassified";
}

export function validateTypeOnlySource(source: string): boolean {
  const file = ts.createSourceFile("types.ts", source, ts.ScriptTarget.Latest, false);
  return file.statements.every(
    (statement) =>
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      (ts.isImportDeclaration(statement) && Boolean(statement.importClause?.isTypeOnly)) ||
      (ts.isExportDeclaration(statement) && statement.isTypeOnly),
  );
}

async function classifiedSources(): Promise<Map<string, SourceCategory>> {
  const sources = new Map<string, SourceCategory>();
  const glob = new Bun.Glob("**/*.{ts,tsx,mts,js}");
  for await (const file of glob.scan({ cwd: resolve(ROOT, "src") })) {
    const path = `src/${file}`;
    sources.set(path, sourceCategory(path));
  }
  return sources;
}

type CoverageRecord = {
  functionsFound: number;
  functionsHit: number;
  linesFound: number;
  linesHit: number;
};

function coverageMetric(values: Map<string, string>, key: string, source: string): number {
  const raw = values.get(key);
  const value = Number(raw);
  if (!raw || !/^\d+$/.test(raw) || !Number.isSafeInteger(value)) {
    throw new Error(`Invalid ${key} for ${source}`);
  }
  return value;
}

export function coverageRecords(lcov: string): Map<string, CoverageRecord> {
  const records = new Map<string, CoverageRecord>();

  for (const block of lcov.split("end_of_record")) {
    const values = new Map(
      block
        .split("\n")
        .filter((line) => line.includes(":"))
        .map((line) => [line.slice(0, line.indexOf(":")), line.slice(line.indexOf(":") + 1)]),
    );
    const source = values.get("SF");
    if (!source) continue;

    const path = source.startsWith(ROOT) ? relative(ROOT, source) : source;
    if (records.has(path)) throw new Error(`Duplicate LCOV record: ${path}`);
    records.set(path, {
      functionsFound: coverageMetric(values, "FNF", path),
      functionsHit: coverageMetric(values, "FNH", path),
      linesFound: coverageMetric(values, "LF", path),
      linesHit: coverageMetric(values, "LH", path),
    });
  }

  return records;
}

export function validateCoverage(
  expected: readonly string[],
  actual: ReadonlyMap<string, CoverageRecord>,
): string[] {
  const errors: string[] = [];
  if (expected.length === 0) errors.push("No business source files found");

  for (const file of expected) {
    const record = actual.get(file);
    if (!record) {
      errors.push(`Missing from unit coverage: ${file}`);
    } else if (record.linesFound === 0) {
      errors.push(`Empty coverage record: ${file}`);
    } else if (
      record.functionsHit !== record.functionsFound ||
      record.linesHit !== record.linesFound
    ) {
      errors.push(
        `Below 100% unit coverage: ${file}: functions ${record.functionsHit}/${record.functionsFound}, lines ${record.linesHit}/${record.linesFound}`,
      );
    }
  }

  return errors;
}

if (import.meta.main) {
  const sources = await classifiedSources();
  const classificationErrors: string[] = [];
  for (const [file, category] of sources) {
    if (category === "unclassified") classificationErrors.push(`Unclassified source file: ${file}`);
    if (
      category === "type-only" &&
      !validateTypeOnlySource(await Bun.file(resolve(ROOT, file)).text())
    ) {
      classificationErrors.push(`Type-only exception contains runtime code: ${file}`);
    }
  }
  if (classificationErrors.length) {
    console.error(classificationErrors.join("\n"));
    process.exit(1);
  }

  const expected = [...sources]
    .filter(([, category]) => category === "business")
    .map(([file]) => file)
    .sort();
  const actual = coverageRecords(await Bun.file(COVERAGE_FILE).text());
  const errors = validateCoverage(expected, actual);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  console.log(
    `Business unit coverage passed: ${expected.length}/${expected.length} files at 100%.`,
  );
}
