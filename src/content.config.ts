import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().optional().default(false),
    tags: z.array(z.string()).min(1),
    category: z.string().optional(),
    type: z.enum(["tutorial", "note", "essay"]).optional(),
    heroImage: z.string().optional(),
    syndicatedTo: z
      .array(
        z.object({
          platform: z.string(),
          url: z.string().url()
        })
      )
      .optional()
      .default([])
  })
});

export const collections = { blog };
