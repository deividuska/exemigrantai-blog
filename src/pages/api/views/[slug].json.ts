import type { APIRoute } from 'astro';

export const prerender = false;

type ViewStore = {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string) => Promise<void>;
};

function getViewStore(locals: App.Locals) {
  const env = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env;
  const store = env?.VIEW_COUNTS ?? env?.SESSION;

  if (
    store &&
    typeof (store as ViewStore).get === 'function' &&
    typeof (store as ViewStore).put === 'function'
  ) {
    return store as ViewStore;
  }

  return undefined;
}

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function normalizeSlug(slug: string | undefined) {
  return slug?.replace(/[^a-z0-9-]/gi, '').slice(0, 160);
}

export const GET: APIRoute = async ({ locals, params }) => {
  const slug = normalizeSlug(params.slug);

  if (!slug) {
    return json({ enabled: false, count: null }, 400);
  }

  const store = getViewStore(locals);

  if (!store) {
    return json({ enabled: false, count: null });
  }

  const count = Number.parseInt((await store.get(`views:${slug}`)) ?? '0', 10) || 0;
  return json({ enabled: true, count });
};

export const POST: APIRoute = async ({ locals, params }) => {
  const slug = normalizeSlug(params.slug);

  if (!slug) {
    return json({ enabled: false, count: null }, 400);
  }

  const store = getViewStore(locals);

  if (!store) {
    return json({ enabled: false, count: null });
  }

  const key = `views:${slug}`;
  const nextCount = (Number.parseInt((await store.get(key)) ?? '0', 10) || 0) + 1;
  await store.put(key, String(nextCount));

  return json({ enabled: true, count: nextCount });
};
