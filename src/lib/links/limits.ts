/** Input limits shared by the session routes, /api/v1 and the MCP server. */
export const MAX_DESCRIPTION_LENGTH = 10000
export const MAX_TAG_NAME_LENGTH = 50
export const MAX_URL_LENGTH = 2048
export const MAX_TITLE_LENGTH = 500
/** Scraped og/meta descriptions are cut to this; users can still write longer ones. */
export const MAX_SCRAPED_DESCRIPTION_LENGTH = 2000

/** Cuts text to at most max characters, ending with an ellipsis when it was cut. */
export function truncateText(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}
