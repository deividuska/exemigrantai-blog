import { collection, config, fields, singleton } from '@keystatic/core';

const imageDirectory = 'src/assets/images/posts';
const imagePublicPath = '@assets/images/posts/';

export default config({
  storage: { kind: 'cloud' },
  cloud: {
    project: 'solid-digital/exemigrantai-blog',
  },
  ui: {
    brand: {
      name: 'Eks Emigrantai',
    },
    navigation: {
      Content: ['posts'],
      Site: ['settings'],
    },
  },
  collections: {
    posts: collection({
      label: 'Posts',
      path: 'src/content/posts/*/',
      slugField: 'title',
      format: { contentField: 'content' },
      columns: ['title', 'publishedAt', 'category'],
      schema: {
        title: fields.slug({
          name: {
            label: 'Title',
            validation: { isRequired: true },
          },
          slug: {
            label: 'Slug',
            description: 'Used in the /blog/[slug] URL.',
          },
        }),
        publishedAt: fields.datetime({
          label: 'Published at',
          validation: { isRequired: true },
        }),
        excerpt: fields.text({
          label: 'Excerpt',
          multiline: true,
          validation: { isRequired: true },
        }),
        category: fields.text({
          label: 'Category',
          defaultValue: 'Naujienos',
        }),
        featuredImage: fields.image({
          label: 'Featured image',
          directory: imageDirectory,
          publicPath: imagePublicPath,
        }),
        featuredImageAlt: fields.text({
          label: 'Featured image alt',
        }),
        readingTime: fields.integer({
          label: 'Reading time (minutes)',
          validation: { isRequired: true, min: 1 },
        }),
        seoTitle: fields.text({
          label: 'SEO title',
        }),
        seoDescription: fields.text({
          label: 'SEO description',
          multiline: true,
        }),
        content: fields.markdoc({
          label: 'Content',
          extension: 'mdoc',
          options: {
            image: {
              directory: imageDirectory,
              publicPath: imagePublicPath,
            },
          },
        }),
      },
    }),
  },
  singletons: {
    settings: singleton({
      label: 'Settings',
      path: 'src/content/settings/',
      schema: {
        homepageTitle: fields.text({
          label: 'Homepage title',
          validation: { isRequired: true },
        }),
        navigation: fields.array(
          fields.object({
            label: fields.text({
              label: 'Label',
              validation: { isRequired: true },
            }),
            href: fields.text({
              label: 'Path',
              description: 'Use internal paths like /kontaktai.',
              validation: { isRequired: true },
            }),
          }),
          {
            label: 'Navigation links',
            itemLabel: (props) => props.fields.label.value || 'New link',
          }
        ),
        facebookGroupUrl: fields.url({
          label: 'Facebook group URL',
          validation: { isRequired: true },
        }),
        footerText: fields.text({
          label: 'Footer text',
          validation: { isRequired: true },
        }),
      },
    }),
  },
});
