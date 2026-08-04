# Automated blog publishing

The generator creates one complete Lithuanian Markdoc post and, by default, one featured image. It reads existing posts, rejects duplicate or very similar titles, validates the house structure and does not write a post until all validation checks pass. It aims for 800-1,200 words, accepts complete posts from 700 words, and never rejects a post merely for falling short of an artificial SEO word count.

The automation has two content lanes:

- `migration` - practical articles for Lithuanians moving between Lithuania and the UK, USA, Canada, Sweden or Norway, or returning to Lithuania.
- `lithuanian_knowledge` - the section `Ką turi žinoti kiekvienas lietuvis`, covering Lithuanian history, statehood, culture, public memory, Soviet/independence-era media, cinema, TV and shared national reference points.

The Lithuanian knowledge lane must explain topics deeply enough for Lithuanians abroad, returning emigrants and their children to understand the facts, timeline, meaning, common misunderstandings and why the topic still matters. It is not a random trivia lane.

## What runs

`scripts/generate-post.mjs` uses the OpenAI Responses API to research reliable sources and write the article. It then uses the OpenAI Images API to create a landscape featured image from the article-specific image brief.

The first article attempt is the only attempt with web search enabled. If validation finds a mechanical problem (for example, length, JSON structure or an invalid internal link), the generator keeps that response and makes up to two cheaper repair attempts without web search. Those repairs receive the saved draft and the exact validation feedback, so they preserve the researched facts and source links rather than starting the research again.

The image call includes three existing featured images as visual references. Every generated image must remain an original article-specific scene, but follows the established warm paper-cut editorial collage style. Migration posts use practical movement/document imagery; Lithuanian knowledge posts use history, culture, memory, archive, media and symbolic-object imagery while avoiding protected characters, logos or direct still recreations.

The workflow runs at 06:00 UTC on weekdays. With `CONTENT_LANE=auto`, the generator routes Monday, Wednesday and Friday to `migration`, and Tuesday and Thursday to `lithuanian_knowledge`. It can also be run manually from **Actions -> Daily AI blog post -> Run workflow**, where the content lane can be left on `auto` or forced to one lane for testing.

## Required GitHub setup

1. Create an OpenAI API key at <https://platform.openai.com/api-keys> with billing enabled.
2. In GitHub, open **Settings -> Secrets and variables -> Actions**.
3. Add a repository secret named `OPENAI_API_KEY` and paste that key there.
4. In **Settings -> Actions -> General**, select **Read and write permissions** for workflow permissions.
5. Run the workflow manually once and inspect the generated article and image before relying on the schedule.

The script needs no other secret. A ChatGPT subscription is separate from API billing; the workflow requires an API-platform key.

## Local dry run

To exercise validation without generating an image:

```powershell
$env:OPENAI_API_KEY="your_key"
$env:GENERATE_FEATURED_IMAGE="false"
$env:CONTENT_LANE="lithuanian_knowledge"
node scripts/generate-post.mjs
Remove-Item Env:\OPENAI_API_KEY
Remove-Item Env:\CONTENT_LANE
```

Do not commit a key or add it to a tracked `.env` file. The workflow never logs the key.

## Adjusting cost or cadence

- Schedule: edit `.github/workflows/daily-post.yml`.
- Content lane: set `CONTENT_LANE` to `auto`, `migration`, or `lithuanian_knowledge`.
- Article model and effort: `POST_MODEL` and `POST_EFFORT`.
- Image generation: set `GENERATE_FEATURED_IMAGE` to `false` to publish text-only articles.
- Image cost/quality: set `IMAGE_QUALITY` to `low`, `medium`, or `high`.

The workflow currently uses `medium` quality and a 1536x1024 landscape image. It creates one image per article; it does not retry image generation, so an image failure prevents publication rather than producing a mismatched text-only post.
