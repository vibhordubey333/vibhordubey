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
  googleAnalyticsId: "G-XXXXXXXXXX", // TODO: Replace with your actual Measurement ID
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
    bio: "I am a Software Engineer with 8+ years of experience designing, building, and operating scalable cloud-native backend systems . Most of my work lives at the intersection of distributed systems, observability, and event-driven architecture — building high-performance REST/gRPC/GraphQL APIs, designing for failure, reducing MTTD, and making production systems less surprising. I focus on improving reliability, observability, and deployment efficiency using Kafka/NATS, AWS, Terraform, Kubernetes, and CI/CD.",
    url: "https://github.com/vibhordubey333",
    email: "mailto:hello@vibhordubey.dev"
  },
  socialLinks: [
    { label: "GitHub", href: "https://github.com/vibhordubey333" },
    { label: "RSS", href: "/rss.xml" }
  ],
  giscus: {
    enabled: true,
    repo: "vibhordubey333/vibhordubey",
    // Get repoId and categoryId from https://giscus.app after enabling GitHub Discussions
    repoId: "REPLACE_WITH_REPO_ID",
    category: "Comments",
    categoryId: "REPLACE_WITH_CATEGORY_ID",
  }
} as const;

export default siteConfig;
