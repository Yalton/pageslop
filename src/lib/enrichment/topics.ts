/**
 * Shared topic tags for rule-based enrichment.
 *
 * Keyword tags come from a page's own words, so most end up on one link only.
 * Topics are a fixed vocabulary matched from the title, description, URL and
 * body, so links about the same thing share a tag even when a page has almost
 * no text (a login screen, a self-hosted app, a bot challenge).
 */

export interface Topic {
  tag: string
  /** Lowercase words or phrases; a trailing "s" plural also matches. */
  signals: string[]
  /** Hosts (or parent domains) that imply the topic. */
  hosts?: string[]
}

export const TOPICS: Topic[] = [
  {
    tag: 'ai',
    signals: [
      'ai', 'artificial intelligence', 'machine learning', 'deep learning', 'llm', 'language model',
      'gpt', 'chatgpt', 'claude', 'anthropic', 'openai', 'gemini', 'llama', 'localllama', 'mistral',
      'qwen', 'deepseek', 'minimax', 'hugging face', 'huggingface', 'neural network', 'transformer',
      'fine tune', 'fine tuning', 'inference', 'prompt', 'agentic', 'ai agent', 'diffusion', 'model weights',
      'ollama', 'copilot',
    ],
    hosts: ['huggingface.co', 'openai.com', 'anthropic.com', 'claude.ai', 'ollama.com', 'kaggle.com'],
  },
  {
    tag: 'code',
    signals: [
      'programming', 'developer', 'source code', 'api', 'sdk', 'javascript', 'typescript', 'python',
      'rust', 'golang', 'java', 'c sharp', 'csharp', 'react', 'nextjs', 'node js', 'nodejs', 'npm',
      'git', 'repository', 'compiler', 'library', 'framework', 'coding', 'software engineering',
      'pull request', 'commit',
    ],
    hosts: ['github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com', 'npmjs.com', 'pypi.org', 'crates.io'],
  },
  {
    tag: 'self-hosted',
    signals: [
      'self hosted', 'selfhosted', 'homelab', 'home lab', 'jellyfin', 'plex', 'portainer', 'pi hole',
      'pihole', 'gitea', 'forgejo', 'ombi', 'sonarr', 'radarr', 'proxmox', 'home assistant', 'nextcloud',
      'unraid', 'truenas', 'nginx proxy manager', 'file browser', 'vaultwarden', 'heimdall', 'immich',
      'syncthing', 'uptime kuma', 'grafana',
    ],
  },
  {
    tag: 'cloud',
    signals: ['cloud', 'aws', 'amazon web services', 'azure', 'gcp', 'google cloud', 'cloudflare', 'serverless', 'vercel', 'netlify'],
    hosts: ['cloud.google.com', 'aws.amazon.com', 'azure.microsoft.com', 'cloudflare.com', 'vercel.com'],
  },
  {
    tag: 'devops',
    signals: [
      'devops', 'kubernetes', 'docker', 'container', 'terraform', 'ansible', 'ci cd', 'jenkins',
      'pipeline', 'infrastructure', 'sre', 'observability', 'deployment',
    ],
  },
  {
    tag: 'security',
    signals: [
      'security', 'cybersecurity', 'vulnerability', 'exploit', 'malware', 'ransomware', 'encryption',
      'cve', 'threat actor', 'hacker', 'hacking', 'pentest', 'penetration testing', 'phishing',
      'firewall', 'tor', 'anonymity', 'de anonymizing', 'zero day',
    ],
  },
  {
    tag: 'networking',
    signals: ['dns', 'ip address', 'network', 'networking', 'router', 'tcp', 'vpn', 'proxy', 'subnet', 'bandwidth'],
  },
  {
    tag: 'linux',
    signals: ['linux', 'ubuntu', 'debian', 'fedora', 'arch linux', 'bash', 'shell script', 'terminal', 'systemd'],
  },
  {
    tag: 'jobs',
    signals: [
      'job', 'career', 'hiring', 'recruiter', 'recruiting', 'applicant', 'resume', 'salary',
      'job seeker', 'apply now', 'open position', 'job opening', 'remote work',
    ],
    hosts: [
      'lever.co', 'greenhouse.io', 'ashbyhq.com', 'jazzhr.com', 'applytojob.com', 'jobscore.com',
      'workday.com', 'myworkdayjobs.com', 'indeed.com', 'glassdoor.com', 'dataannotation.tech',
    ],
  },
  {
    tag: 'gaming',
    signals: [
      'game', 'gaming', 'gamer', 'steam', 'itch io', 'nintendo', 'playstation', 'xbox', 'pokemon',
      'esports', 'multiplayer', 'roguelike', 'speedrun',
    ],
    hosts: ['steampowered.com', 'steamgames.com', 'steamcommunity.com', 'itch.io', 'store.epicgames.com'],
  },
  {
    tag: 'gamedev',
    signals: [
      'game development', 'game developer', 'gamedev', 'game engine', 'unity', 'unreal engine', 'godot',
      'steamworks', 'mixamo', 'sprite', 'game jam', 'level design',
    ],
    hosts: ['mixamo.com', 'partner.steamgames.com', 'unity.com', 'godotengine.org', 'unrealengine.com'],
  },
  {
    tag: 'video',
    signals: ['video', 'youtube', 'streaming', 'twitch', 'video editor', 'video editing', 'shorts', 'subtitle'],
    hosts: ['youtube.com', 'youtu.be', 'vimeo.com', 'twitch.tv', 'capcut.com'],
  },
  {
    tag: 'music',
    signals: ['music', 'piano', 'song', 'guitar', 'synth', 'synthesizer', 'midi', 'spotify', 'soundcloud', 'bandcamp', 'chord', 'melody'],
    hosts: ['spotify.com', 'soundcloud.com', 'bandcamp.com'],
  },
  {
    tag: 'media',
    signals: ['movie', 'tv show', 'film', 'media server', 'media request', 'anime', 'manga', 'fumo', 'touhou', 'jellyfin', 'plex', 'ombi', 'sonarr', 'radarr'],
  },
  {
    tag: 'design',
    signals: [
      'design', 'designer', 'figma', 'ui', 'ux', 'typography', 'font', 'icon', 'illustration', '3d model',
      'animation', 'texture', 'hdri', 'blender', 'shader', '3d',
    ],
    hosts: ['figma.com', 'dribbble.com', 'behance.net'],
  },
  {
    tag: 'learning',
    signals: ['tutorial', 'course', 'lesson', 'learn', 'guide', 'how to', 'beginner', 'documentation', 'cheat sheet'],
    hosts: ['coursera.org', 'udemy.com', 'edx.org', 'khanacademy.org'],
  },
  {
    tag: 'research',
    signals: ['research', 'paper', 'arxiv', 'study', 'dataset', 'benchmark', 'experiment', 'findings', 'write up'],
    hosts: ['arxiv.org', 'scholar.google.com'],
  },
  {
    tag: 'data',
    signals: ['data science', 'analytics', 'database', 'sql', 'postgres', 'postgresql', 'dataset', 'kaggle', 'data annotation', 'spreadsheet'],
  },
  {
    tag: 'news',
    signals: ['news', 'breaking news', 'headline', 'reporter', 'journalism'],
    hosts: ['bbc.com', 'nytimes.com', 'theguardian.com', 'reuters.com', 'news.ycombinator.com'],
  },
  {
    tag: 'social',
    signals: ['social', 'social media', 'reddit', 'subreddit', 'forum', 'discord', 'community', 'twitter', 'mastodon', 'bluesky'],
    hosts: ['reddit.com', 'twitter.com', 'x.com', 'bsky.app', 'discord.com', 'linkedin.com'],
  },
  {
    tag: 'shopping',
    signals: ['shop', 'shopping', 'buy', 'add to cart', 'price', 'deal', 'checkout', 'free shipping'],
    hosts: ['amazon.com', 'ebay.com', 'etsy.com', 'aliexpress.com'],
  },
  {
    tag: 'finance',
    signals: ['finance', 'stock', 'investing', 'invest', 'crypto', 'bitcoin', 'bank', 'budget', 'tax', 'payment'],
  },
  {
    tag: 'health',
    signals: ['health', 'medical', 'fitness', 'nutrition', 'workout', 'mental health', 'sleep'],
  },
  {
    tag: 'productivity',
    signals: ['productivity', 'note taking', 'todo', 'task manager', 'calendar', 'notion', 'obsidian', 'workflow'],
  },
  {
    tag: 'email',
    signals: ['email', 'mail', 'inbox', 'gmail', 'smtp', 'newsletter'],
    hosts: ['zoho.com', 'mail.google.com', 'proton.me', 'fastmail.com'],
  },
  {
    tag: 'business',
    signals: ['startup', 'saas', 'marketing', 'sales', 'crm', 'business', 'founder', 'agency', 'client portal'],
  },
  {
    tag: 'hardware',
    signals: [
      'hardware', 'electronics', 'power supply', 'raspberry pi', 'arduino', 'adapter', 'cctv',
      'pcb', 'soldering', 'gpu', 'cpu', 'keyboard', 'monitor',
    ],
  },
  {
    tag: 'philosophy',
    signals: ['philosophy', 'esoteric', 'occult', 'metaphysics', 'mysticism', 'religion', 'spirituality'],
  },
]

const TOPIC_TAGS = new Set(TOPICS.map((t) => t.tag))

/** True when `name` is one of the shared topic tags. */
export function isTopicTag(name: string): boolean {
  return TOPIC_TAGS.has(name)
}

/** True when `word` is one of the signals of any topic in `tags`. */
export function isTopicSignal(word: string, tags: string[]): boolean {
  return TOPICS.some((t) => tags.includes(t.tag) && t.signals.includes(word))
}

/** Longest topic list a link gets. */
const MAX_TOPICS = 3
/** Score a topic needs: one title, description, URL or host hit, or several body hits. */
const MIN_TOPIC_SCORE = 3
const BODY_HIT_CAP = 3

/** Lowercase, collapse punctuation to single spaces, pad, so phrases match whole words. */
function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `
}

/** How many of a topic's signals occur in `text` (already normalized). */
function countHits(text: string, signals: string[]): number {
  if (text.length <= 2) return 0
  let hits = 0
  for (const signal of signals) {
    const s = normalize(signal)
    if (text.includes(s) || text.includes(`${s.trimEnd()}s `)) hits++
  }
  return hits
}

const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)|\.(lan|local|home|internal|home\.arpa)$/

function parseUrl(url: string | null | undefined): URL | null {
  if (!url) return null
  try {
    return new URL(url)
  } catch {
    return null
  }
}

function hostMatches(host: string, hosts: string[] | undefined): boolean {
  return (hosts ?? []).some((h) => host === h || host.endsWith(`.${h}`))
}

export interface TopicInput {
  title?: string | null
  description?: string | null
  bodyText?: string | null
  url?: string | null
}

/**
 * Topic tags for a link, strongest first, at most three. Title, description,
 * URL and host hits each qualify a topic alone; body hits count least (capped),
 * so a passing mention in a long page does not tag it.
 */
export function matchTopics(input: TopicInput): string[] {
  const parsed = parseUrl(input.url)
  const host = parsed?.hostname.toLowerCase().replace(/^www\./, '') ?? ''
  // Host labels minus the TLD, plus path segments: "dash.cloudflare.com/x" -> "dash cloudflare x".
  const urlText = parsed
    ? normalize(`${host.split('.').slice(0, -1).join(' ')} ${decodeURIComponent(parsed.pathname)}`)
    : ' '
  const title = normalize(input.title ?? '')
  // A description holding markup is a leaked bot-challenge page, not a summary.
  const description = input.description && !input.description.includes('<') ? normalize(input.description) : ' '
  const body = normalize(input.bodyText ?? '')

  const scored: { tag: string; score: number }[] = []
  for (const topic of TOPICS) {
    let score =
      3 * countHits(title, topic.signals) +
      3 * countHits(urlText, topic.signals) +
      3 * countHits(description, topic.signals) +
      Math.min(countHits(body, topic.signals), BODY_HIT_CAP)
    if (host && hostMatches(host, topic.hosts)) score += 3
    if (topic.tag === 'self-hosted' && PRIVATE_HOST.test(host)) score += 3
    if (score >= MIN_TOPIC_SCORE) scored.push({ tag: topic.tag, score })
  }
  // Array.sort is stable, so equal scores keep TOPICS order.
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_TOPICS)
    .map((t) => t.tag)
}
