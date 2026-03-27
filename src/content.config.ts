import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      publishedAt: z
        .union([z.string(), z.date()])
        .transform((value) =>
          value instanceof Date ? value.toISOString().slice(0, 16) : value
        ),
      category: z.string().default('Naujienos'),
      featuredImage: image().optional(),
      featuredImageAlt: z.string().optional(),
      seoTitle: z.string().optional(),
      seoDescription: z.string().optional(),
    }),
});

const settings = defineCollection({
  type: 'data',
  schema: z.object({
    homepageTitle: z.string(),
    navigation: z
      .array(
        z.object({
          label: z.string(),
          href: z.string(),
        })
      )
      .default([]),
    facebookGroupUrl: z.string().url(),
    footerText: z.string(),
  }),
});

export const collections = { posts, settings };
