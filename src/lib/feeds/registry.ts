/**
 * Feed Source Registry
 *
 * 28 curated healthcare RSS/Atom/Google-News-proxy sources organized
 * by category. Used to seed FeedSource records in the database on
 * first ingestion run.
 */

export interface FeedSourceConfig {
  url: string;
  name: string;
  feedType: "rss" | "atom" | "google-news";
  category: string;
  subcategory?: string;
  pollIntervalHours: number;
}

export const FEED_REGISTRY: FeedSourceConfig[] = [
  // ─── Regulatory (7) ─────────────────────────────────────────
  {
    url: "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/drugs/rss.xml",
    name: "FDA Drug News",
    feedType: "rss",
    category: "regulatory",
    subcategory: "drug-approvals",
    pollIntervalHours: 4,
  },
  {
    url: "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/medical-devices/rss.xml",
    name: "FDA Device News",
    feedType: "rss",
    category: "regulatory",
    subcategory: "device-approvals",
    pollIntervalHours: 4,
  },
  {
    url: "https://www.cms.gov/newsroom/rss",
    name: "CMS Newsroom",
    feedType: "rss",
    category: "regulatory",
    subcategory: "cms-updates",
    pollIntervalHours: 4,
  },
  {
    url: "https://www.federalregister.gov/api/v1/documents.rss?conditions%5Bagencies%5D%5B%5D=health-and-human-services-department",
    name: "Federal Register Health",
    feedType: "rss",
    category: "regulatory",
    subcategory: "federal-register",
    pollIntervalHours: 6,
  },
  {
    url: "https://www.hhs.gov/rss/news.xml",
    name: "HHS News",
    feedType: "rss",
    category: "regulatory",
    subcategory: "hhs",
    pollIntervalHours: 6,
  },
  {
    url: "https://www.nih.gov/news-events/news-releases/feed",
    name: "NIH News",
    feedType: "rss",
    category: "regulatory",
    subcategory: "nih",
    pollIntervalHours: 6,
  },
  {
    url: "https://tools.cdc.gov/podcasts/feed.asp?feedid=183",
    name: "CDC MMWR",
    feedType: "rss",
    category: "regulatory",
    subcategory: "cdc",
    pollIntervalHours: 12,
  },

  // ─── Legislative (4) ────────────────────────────────────────
  {
    url: "https://news.google.com/rss/search?q=healthcare+bill+congress&hl=en-US",
    name: "Congress Health Bills",
    feedType: "google-news",
    category: "legislative",
    subcategory: "bills",
    pollIntervalHours: 4,
  },
  {
    url: "https://news.google.com/rss/search?q=senate+HELP+committee+healthcare&hl=en-US",
    name: "Senate HELP Committee",
    feedType: "google-news",
    category: "legislative",
    subcategory: "committee",
    pollIntervalHours: 6,
  },
  {
    url: "https://www.cbo.gov/topics/health/rss.xml",
    name: "CBO Health Reports",
    feedType: "rss",
    category: "legislative",
    subcategory: "cbo",
    pollIntervalHours: 12,
  },
  {
    url: "https://www.gao.gov/rss/reports/health.xml",
    name: "GAO Health Reports",
    feedType: "rss",
    category: "legislative",
    subcategory: "gao",
    pollIntervalHours: 12,
  },

  // ─── Industry (5) ───────────────────────────────────────────
  {
    url: "https://www.fiercepharma.com/rss/xml",
    name: "FiercePharma",
    feedType: "rss",
    category: "industry",
    subcategory: "pharma",
    pollIntervalHours: 2,
  },
  {
    url: "https://www.fiercehealthcare.com/rss/xml",
    name: "FierceHealthcare",
    feedType: "rss",
    category: "industry",
    subcategory: "healthcare",
    pollIntervalHours: 2,
  },
  {
    url: "https://www.modernhealthcare.com/section/rss",
    name: "Modern Healthcare",
    feedType: "rss",
    category: "industry",
    subcategory: "healthcare",
    pollIntervalHours: 4,
  },
  {
    url: "https://news.google.com/rss/search?q=site:statnews.com&hl=en-US",
    name: "STAT News",
    feedType: "google-news",
    category: "industry",
    subcategory: "pharma",
    pollIntervalHours: 2,
  },
  {
    url: "https://www.biopharmadive.com/feeds/news/",
    name: "BioPharma Dive",
    feedType: "rss",
    category: "industry",
    subcategory: "biopharma",
    pollIntervalHours: 4,
  },

  // ─── Research (4) ───────────────────────────────────────────
  {
    url: "https://www.nejm.org/action/showFeed?jc=nejm&type=etoc&feed=rss",
    name: "NEJM",
    feedType: "rss",
    category: "research",
    subcategory: "journals",
    pollIntervalHours: 12,
  },
  {
    url: "https://jamanetwork.com/rss/site_256/67.xml",
    name: "JAMA",
    feedType: "rss",
    category: "research",
    subcategory: "journals",
    pollIntervalHours: 12,
  },
  {
    url: "https://www.healthaffairs.org/action/showFeed?type=etoc&feed=rss&jc=hlthaff",
    name: "Health Affairs Blog",
    feedType: "rss",
    category: "research",
    subcategory: "policy",
    pollIntervalHours: 6,
  },
  {
    url: "https://kffhealthnews.org/feed/",
    name: "KFF Health News",
    feedType: "rss",
    category: "research",
    subcategory: "policy",
    pollIntervalHours: 4,
  },

  // ─── M&A / Payer (4) ───────────────────────────────────────
  {
    url: "https://news.google.com/rss/search?q=healthcare+merger+acquisition&hl=en-US",
    name: "M&A Healthcare",
    feedType: "google-news",
    category: "ma-payer",
    subcategory: "mergers",
    pollIntervalHours: 4,
  },
  {
    url: "https://news.google.com/rss/search?q=health+insurance+payer+medicare+advantage&hl=en-US",
    name: "Payer News",
    feedType: "google-news",
    category: "ma-payer",
    subcategory: "payer",
    pollIntervalHours: 4,
  },
  {
    url: "https://news.google.com/rss/search?q=hospital+acquisition+merger&hl=en-US",
    name: "Hospital M&A",
    feedType: "google-news",
    category: "ma-payer",
    subcategory: "hospital-ma",
    pollIntervalHours: 6,
  },
  {
    url: "https://news.google.com/rss/search?q=private+equity+healthcare&hl=en-US",
    name: "PE Healthcare",
    feedType: "google-news",
    category: "ma-payer",
    subcategory: "private-equity",
    pollIntervalHours: 6,
  },

  // ─── Innovation (4) ─────────────────────────────────────────
  {
    url: "https://news.google.com/rss/search?q=digital+health+startup+funding&hl=en-US",
    name: "Digital Health",
    feedType: "google-news",
    category: "innovation",
    subcategory: "digital-health",
    pollIntervalHours: 4,
  },
  {
    url: "https://www.healthcareitnews.com/feed",
    name: "Health IT",
    feedType: "rss",
    category: "innovation",
    subcategory: "health-it",
    pollIntervalHours: 4,
  },
  {
    url: "https://news.google.com/rss/search?q=site:rockhealth.com&hl=en-US",
    name: "Rock Health",
    feedType: "google-news",
    category: "innovation",
    subcategory: "venture",
    pollIntervalHours: 12,
  },
  {
    url: "https://www.mobihealthnews.com/feed",
    name: "MobiHealthNews",
    feedType: "rss",
    category: "innovation",
    subcategory: "mobile-health",
    pollIntervalHours: 4,
  },
];
