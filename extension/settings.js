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

// IPv6 literals are returned bracketed and compressed, as URL.hostname has them.
function normalizeIpv6(literal) {
	try {
		return new URL(`http://[${literal}]/`).hostname;
	} catch {
		return "";
	}
}

function normalizeDomain(entry) {
	if (typeof entry !== "string") return "";
	let d = entry.trim().toLowerCase();
	d = d.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
	d = d.split(/[/?#]/)[0];
	if (d.startsWith("[")) return normalizeIpv6(d.slice(1, d.indexOf("]")));
	if (d.split(":").length > 2) return normalizeIpv6(d);
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

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function normalizeServerUrl(value) {
	if (typeof value !== "string" || value.trim() === "") return "";
	let url;
	try {
		url = new URL(value.trim());
	} catch {
		return "";
	}
	if (url.protocol === "http:") {
		// Plain http would send the API token in the clear; allow it only for a
		// server on this machine.
		if (!LOOPBACK_HOSTS.has(url.hostname)) return "";
	} else if (url.protocol !== "https:") return "";
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

// Host permission pattern for the server. Firefox accepts a pattern with a
// port and reports it as granted, but requests to that port still fail as
// cross-origin, so the pattern names the host without its port.
export function hostPermissionPattern(serverUrl) {
	if (typeof serverUrl !== "string" || serverUrl === "") return "";
	try {
		const url = new URL(serverUrl);
		return `${url.protocol}//${url.hostname}/*`;
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
