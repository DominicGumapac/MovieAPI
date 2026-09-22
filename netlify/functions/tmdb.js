// Netlify serverless function: proxies requests to TMDB.
// The real API key lives only in the TMDB_API_KEY environment variable
// (set in the Netlify dashboard, or in a local .env file for `netlify dev`)
// and is never sent to the browser.

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Only these TMDB endpoints are reachable through the proxy, so this
// function can't be used as an open relay to arbitrary TMDB paths.
const ALLOWED_PATHS = [
  /^\/movie\/(popular|top_rated|now_playing|upcoming)$/,
  /^\/movie\/\d+$/,
  /^\/movie\/\d+\/credits$/,
  /^\/search\/movie$/,
];

exports.handler = async function (event) {
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'TMDB_API_KEY is not set on the server.' }),
    };
  }

  const params = event.queryStringParameters || {};
  const { path, ...rest } = params;

  if (!path) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing "path" query parameter.' }),
    };
  }

  const isAllowed = ALLOWED_PATHS.some((re) => re.test(path));
  if (!isAllowed) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'That TMDB path is not permitted.' }),
    };
  }

  const url = new URL(TMDB_BASE + path);
  url.searchParams.set('api_key', apiKey);
  for (const [key, value] of Object.entries(rest)) {
    url.searchParams.set(key, value);
  }

  try {
    const tmdbRes = await fetch(url.toString());
    const data = await tmdbRes.text();
    return {
      statusCode: tmdbRes.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
      body: data,
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'Failed to reach TMDB.' }),
    };
  }
};
