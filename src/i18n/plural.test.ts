import { describe, expect, test } from "bun:test";
import { formatCount } from "./plural";

describe("formatCount", () => {
  test("uses all Russian plural categories", () => {
    expect(formatCount("ru-RU", "teamMembers", 1)).toBe("1 участник");
    expect(formatCount("ru-RU", "teamMembers", 2)).toBe("2 участника");
    expect(formatCount("ru-RU", "teamMembers", 5)).toBe("5 участников");
    expect(formatCount("ru-RU", "teamMembers", 21)).toBe("21 участник");
  });

  test("uses all Arabic plural categories", () => {
    expect(formatCount("ar", "orphanReferences", 0)).toBe("لا توجد مراجع غير صالحة");
    expect(formatCount("ar", "orphanReferences", 1)).toBe("مرجع واحد غير صالح");
    expect(formatCount("ar", "orphanReferences", 2)).toBe("مرجعان غير صالحين");
    expect(formatCount("ar", "orphanReferences", 3)).toBe("3 مراجع غير صالحة");
    expect(formatCount("ar", "orphanReferences", 11)).toBe("11 مرجعًا غير صالح");
    expect(formatCount("ar", "orphanReferences", 102)).toBe("102 مرجع غير صالح");
  });

  test("formats locales without grammatical number variants", () => {
    expect(formatCount("en-US", "devicesTagged", 2)).toBe("2 devices");
    expect(formatCount("zh-Hans", "devicesTagged", 2)).toBe("2 台设备");
    expect(formatCount("ja-JP", "devicesTagged", 2)).toBe("デバイス 2 台");
  });
});
