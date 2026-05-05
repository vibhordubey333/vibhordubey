const siteConfig = {
  title: "Field Notes by Vibhor Dubey",
  tagline: "Publish on your own site first. Syndicate everywhere else with intention.",
  description:
    "A warm, minimal technical blog for distributed systems writeups, production notes, tutorials, and long-form essays.",
  origin: "https://vibhordubey333.github.io",
  repoName: "vibhordubey",
  language: "en",
  locale: "en_US",
  dateLocale: "en-IN",
  rssPath: "/rss.xml",
  defaultOgImage: "/og/default-social.svg",
  themeColors: {
    light: "#f6f3ee",
    dark: "#0e1317"
  },
  navigation: [
    { label: "Blog", href: "/blog/" },
    { label: "About", href: "/about/" }
  ],
  author: {
    name: "Vibhor Dubey",
    role: "Senior Backend Engineer",
    bio: "I build distributed systems that handle high volume load and stay up. Over 8+ years, I have worked across event-driven pipelines, high-throughput APIs, and cloud-native infrastructure, primarily in Go and Java Spring Boot. Most of my work sits at the intersection of distributed systems and observability: designing for failure, reducing MTTD, and making production less surprising.",
    url: "https://github.com/vibhordubey333",
    email: "mailto:hello@vibhordubey.dev"
  },
  socialLinks: [
    { label: "GitHub", href: "https://github.com/vibhordubey333" },
    { label: "RSS", href: "/rss.xml" }
  ]
} as const;

export default siteConfig;
