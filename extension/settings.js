// Settings stored in browser.storage.local. Pure apart from the injected storage area.

export const DEFAULTS = Object.freeze({
	serverUrl: "",
	token: "",
	enabled: false,
	idleHours: 6,
	maxTabs: 25,
	excludeDomains: Object.freeze([]),
	pausedUntil: 0,
	lastSweep: null,
});

const MAX_IDLE_HOURS = 8760;
const MAX_TABS_LIMIT = 10000;
const NUMERIC_STRING = /^\s*\d+(\.\d+)?\s*$/;

function isPlainObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Numbers pass through. Plain decimal strings like "12" or "0.5" are converted,
// because <input> values are strings. Anything else becomes NaN.
function toNumber(value) {
	if (typeof value === "number") return value;
	if (typeof value === "string" && NUMERIC_STRING.test(value))
		return Number(value);
	return Number.NaN;
}

function normalizeIdleHours(value) {
	const n = toNumber(value);
	return Number.isFinite(n) && n > 0 && n <= MAX_IDLE_HOURS
		? n
		: DEFAULTS.idleHours;
}

function normalizeMaxTabs(value) {
	const n = Math.floor(toNumber(value));
	return Number.isFinite(n) && n >= 1 && n <= MAX_TABS_LIMIT
		? n
		: DEFAULTS.maxTabs;
}

function normalizeDomain(entry) {
	if (typeof entry !== "string") return "";
	let d = entry.trim().toLowerCase();
	d = d.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
	d = d.split(/[/?#]/)[0];
	d = d.replace(/:\d+$/, "");
	d = d.replace(/^\*\./, "").replace(/^\.+/, "").replace(/\.+$/, "");
	return d;
}

function normalizeDomains(value) {
	let entries;
	if (Array.isArray(value)) entries = value;
	else if (typeof value === "string") entries = value.split(/[\s,]+/);
	else entries = [];
	const out = [];
	for (const entry of entries) {
		const d = normalizeDomain(entry);
		if (d !== "" && !out.includes(d)) out.push(d);
	}
	return out;
}

function normalizeServerUrl(value) {
	if (typeof value !== "string" || value.trim() === "") return "";
	let url;
	try {
		url = new URL(value.trim());
	} catch {
		return "";
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") return "";
	return (url.origin + url.pathname).replace(/\/+$/, "");
}

function normalizeLastSweep(value) {
	if (!isPlainObject(value)) return null;
	if (!Number.isFinite(value.at) || !Number.isFinite(value.stashed))
		return null;
	const out = { at: value.at, stashed: value.stashed };
	if (typeof value.error === "string" && value.error !== "")
		out.error = value.error;
	return out;
}

export function normalizeSettings(raw) {
	const src = isPlainObject(raw) ? raw : {};
	const pausedUntil = toNumber(src.pausedUntil);
	return {
		serverUrl: normalizeServerUrl(src.serverUrl),
		token: typeof src.token === "string" ? src.token.trim() : "",
		enabled: src.enabled === true,
		idleHours: normalizeIdleHours(src.idleHours),
		maxTabs: normalizeMaxTabs(src.maxTabs),
		excludeDomains: normalizeDomains(src.excludeDomains),
		pausedUntil:
			Number.isFinite(pausedUntil) && pausedUntil >= 0 ? pausedUntil : 0,
		lastSweep: normalizeLastSweep(src.lastSweep),
	};
}

export function serverOrigin(serverUrl) {
	if (typeof serverUrl !== "string" || serverUrl === "") return "";
	try {
		return new URL(serverUrl).origin;
	} catch {
		return "";
	}
}

export async function loadSettings(storageArea) {
	return normalizeSettings(await storageArea.get(null));
}

export async function saveSettings(storageArea, patch) {
	const current = await loadSettings(storageArea);
	const next = normalizeSettings({ ...current, ...patch });
	await storageArea.set(next);
	return next;
}
