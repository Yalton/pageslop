import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(
	readFileSync(
		new URL("../../extension/manifest.json", import.meta.url),
		"utf8",
	),
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

	it("is version 0.3.3, so the signed update replaces 0.3.2", () => {
		expect(manifest.version).toBe("0.3.3");
	});

	it("still requires Firefox 140", () => {
		expect(manifest.browser_specific_settings.gecko.strict_min_version).toBe(
			"140.0",
		);
	});

	// data_collection_permissions needs Firefox for Android 142.
	it("requires Firefox for Android 142", () => {
		expect(
			manifest.browser_specific_settings.gecko_android?.strict_min_version,
		).toBe("142.0");
	});
});
