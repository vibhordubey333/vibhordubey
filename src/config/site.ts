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
    role: "Software Engineer",
    bio: "I am a Software Engineer with 8+ years of experience designing, building, and operating scalable cloud-native backend systems that handle 10k+ RPS. My work focuses on high-performance REST/gRPC/GraphQL APIs, event-driven architectures (Kafka/NATS), and improving reliability, observability, and deployment efficiency using AWS, Terraform, Kubernetes, and CI/CD.",
    url: "https://github.com/vibhordubey333",
    email: "mailto:hello@vibhordubey.dev"
  },
  socialLinks: [
    { label: "GitHub", href: "https://github.com/vibhordubey333" },
    { label: "RSS", href: "/rss.xml" }
  ]
} as const;

export default siteConfig;
