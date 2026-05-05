const siteConfig = {
  title: "Field Notes by Vibhor Dubey",
  tagline: "Publish on your own site first. Syndicate everywhere else with intention.",
  description:
    "A warm, minimal technical blog for frontend engineering writeups, practical notes, tutorials, and long-form essays.",
  origin: "https://vibhordubey333.github.io",
  repoName: "vibhordubey",
  language: "en",
  locale: "en_US",
  dateLocale: "en-IN",
  rssPath: "/rss.xml",
  defaultOgImage: "/og/default-social.svg",
  navigation: [
    { label: "Home", href: "/" },
    { label: "Blog", href: "/blog/" },
    { label: "About", href: "/about/" },
    { label: "Tags", href: "/tags/" },
    { label: "RSS", href: "/rss.xml" }
  ],
  author: {
    name: "Vibhor Dubey",
    role: "Senior frontend engineer and technical writer",
    bio: "I write about frontend systems, developer tooling, publishing habits, and the small decisions that make software calmer to build and easier to maintain.",
    url: "https://github.com/vibhordubey333",
    email: "mailto:hello@vibhordubey.dev"
  },
  socialLinks: [
    { label: "GitHub", href: "https://github.com/vibhordubey333" },
    { label: "RSS", href: "/rss.xml" }
  ]
} as const;

export default siteConfig;
