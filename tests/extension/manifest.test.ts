import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(
	readFileSync(new URL("../../extension/manifest.json", import.meta.url), "utf8"),
);

describe("manifest", () => {
	it("requests the menus and sessions permissions for keep marks", () => {
		expect(manifest.permissions).toEqual([
			"tabs",
			"alarms",
			"storage",
			"menus",
			"sessions",
		]);
	});

	it("is version 0.2.0, so the signed update replaces 0.1.0", () => {
		expect(manifest.version).toBe("0.2.0");
	});

	it("still requires Firefox 140", () => {
		expect(manifest.browser_specific_settings.gecko.strict_min_version).toBe(
			"140.0",
		);
	});
});
