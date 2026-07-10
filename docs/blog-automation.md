# Automated blog publishing

The generator creates one complete Lithuanian Markdoc post and, by default, one featured image. It reads existing posts, rejects duplicate or very similar titles, validates the house structure and does not write a post until all validation checks pass. It aims for 800-1,200 words, accepts complete posts from 700 words, and never rejects a post merely for falling short of an artificial SEO word count.

## What runs

`scripts/generate-post.mjs` uses the OpenAI Responses API to research official primary sources and write the article. It then uses the OpenAI Images API to create a landscape featured image from the article-specific image brief.

The image call includes three existing featured images as visual references. Every generated image must remain an original article-specific scene, but follows the established warm paper-cut editorial collage style.

The workflow runs at 06:00 UTC on Tuesdays and Fridays, and can also be run manually from **Actions → Daily AI blog post → Run workflow**.

## Required GitHub setup

1. Create an OpenAI API key at <https://platform.openai.com/api-keys> with billing enabled.
2. In GitHub, open **Settings → Secrets and variables → Actions**.
3. Add a repository secret named `OPENAI_API_KEY` and paste that key there.
4. In **Settings → Actions → General**, select **Read and write permissions** for workflow permissions.
5. Run the workflow manually once and inspect the generated article and image before relying on the schedule.

The script needs no other secret. A ChatGPT subscription is separate from API billing; the workflow requires an API-platform key.

## Local dry run

To exercise validation without generating an image:

```powershell
$env:OPENAI_API_KEY="your_key"
$env:GENERATE_FEATURED_IMAGE="false"
node scripts/generate-post.mjs
Remove-Item Env:\OPENAI_API_KEY
```

Do not commit a key or add it to a tracked `.env` file. The workflow never logs the key.

## Adjusting cost or cadence

- Schedule: edit `.github/workflows/daily-post.yml`.
- Article model and effort: `POST_MODEL` and `POST_EFFORT`.
- Image generation: set `GENERATE_FEATURED_IMAGE` to `false` to publish text-only articles.
- Image cost/quality: set `IMAGE_QUALITY` to `low`, `medium`, or `high`.

The workflow currently uses `medium` quality and a 1536×1024 landscape image. It creates one image per article; it does not retry image generation, so an image failure prevents publication rather than producing a mismatched text-only post.
