import type { LinkWithTags } from '@/types'

/**
 * Escape HTML special characters for safe insertion into HTML attributes and text.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Generate a Netscape-format HTML bookmark file from an array of links.
 * Compatible with Chrome, Firefox, and Safari bookmark import.
 */
export function generateNetscapeHTML(links: LinkWithTags[]): string {
  const entries = links
    .map((link) => {
      const addDate = Math.floor(link.createdAt.getTime() / 1000)
      const title = escapeHtml(link.title || link.url)
      return `    <DT><A HREF="${link.url}" ADD_DATE="${addDate}">${title}</A>`
    })
    .join('\n')

  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Pageslop Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
${entries}
</DL><p>`
}
