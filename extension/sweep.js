// Sweep orchestration. Every browser API arrives through `deps`, so this module is unit-testable.
import { BATCH_SIZE, postStash } from "./api.js";
import { selectTabsToStash } from "./select-tabs.js";
import { normalizeSettings } from "./settings.js";

export const ERROR_BADGE_COLOR = "#d32f2f";

let running = false;

function isHttpUrl(url) {
	try {
		const { protocol } = new URL(url);
		return protocol === "http:" || protocol === "https:";
	} catch {
		return false;
	}
}

function messageOf(error) {
	return error instanceof Error ? error.message : String(error);
}

function toPayload(tab, closedAt) {
	const item = { url: tab.url, closedAt };
	if (typeof tab.title === "string" && tab.title !== "") item.title = tab.title;
	return item;
}

async function fail(deps, message) {
	try {
		await deps.setBadge("!", ERROR_BADGE_COLOR);
	} catch {
		// The badge is cosmetic. Never let it hide the real error.
	}
	try {
		await deps.recordError(message);
	} catch {
		// Same for persistence of the error.
	}
	return { error: message };
}

// Re-read each tab and close it only if its CURRENT url was saved.
async function closeConfirmed(deps, batch, saved, requireInactive) {
	const savedUrls = new Set(saved);
	const ids = [];
	for (const tab of batch) {
		let current;
		try {
			current = await deps.getTab(tab.id);
		} catch {
			continue;
		}
		if (!current || !savedUrls.has(current.url)) continue;
		if (requireInactive && (current.active || current.pinned)) continue;
		ids.push(tab.id);
	}
	if (ids.length > 0) await deps.removeTabs(ids);
	return ids.length;
}

async function stashInBatches(deps, settings, tabs, requireInactive) {
	const closedAt = new Date(deps.now()).toISOString();
	let closed = 0;
	for (let i = 0; i < tabs.length; i += BATCH_SIZE) {
		const batch = tabs.slice(i, i + BATCH_SIZE);
		const payload = batch.map((tab) => toPayload(tab, closedAt));
		const result = await postStash(
			deps.fetch,
			settings.serverUrl,
			settings.token,
			payload,
		);
		if (!result.ok) return { closed, error: result.error };
		closed += await closeConfirmed(deps, batch, result.saved, requireInactive);
	}
	return { closed };
}

export async function runSweep(deps) {
	if (running) return { stashed: 0, skipped: "busy" };
	running = true;
	try {
		const settings = normalizeSettings(await deps.getSettings());
		const now = deps.now();
		if (settings.serverUrl === "" || settings.token === "")
			return { stashed: 0, skipped: "unconfigured" };
		if (!deps.force && !settings.enabled)
			return { stashed: 0, skipped: "disabled" };
		if (!deps.force && now < settings.pausedUntil)
			return { stashed: 0, skipped: "paused" };

		// Read keep marks fresh on every run; the event page may have been unloaded.
		const tabs = await deps.withKeptFlag(await deps.queryTabs());
		const selected = selectTabsToStash(tabs, settings, now);
		const result = await stashInBatches(deps, settings, selected, true);
		if (result.error) return await fail(deps, result.error);

		await deps.setBadge("");
		await deps.recordSuccess(result.closed);
		return { stashed: result.closed };
	} catch (error) {
		return await fail(deps, `Sweep failed: ${messageOf(error)}`);
	} finally {
		running = false;
	}
}

// "Stash this tab" from the popup: protections are bypassed except http/https.
export async function stashTab(deps, tabId) {
	try {
		const settings = normalizeSettings(await deps.getSettings());
		if (settings.serverUrl === "" || settings.token === "") {
			return { error: "Set the server URL and token in Options first" };
		}
		const tab = await deps.getTab(tabId);
		if (!tab || !isHttpUrl(tab.url))
			return { error: "Only http and https pages can be stashed" };
		const result = await stashInBatches(deps, settings, [tab], false);
		if (result.error) return await fail(deps, result.error);
		await deps.setBadge("");
		return { stashed: result.closed };
	} catch (error) {
		return await fail(deps, `Stash failed: ${messageOf(error)}`);
	}
}
