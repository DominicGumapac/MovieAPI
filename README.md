# Marquee — a TMDB movie explorer

A small movie browser built on [The Movie Database (TMDB)](https://www.themoviedb.org/) API. Browse popular, top-rated, in-theaters, and upcoming films, search by title, and open a detail view with cast, overview, and ratings.

The API key lives only on the server, as a Netlify environment variable — it's never sent to the browser. The frontend calls a small serverless function (`netlify/functions/tmdb.js`), which adds the key and forwards the request to TMDB.

## Project structure

```
index.html                    the page structure
css/styles.css                all styling
js/script.js                  all frontend logic — calls the proxy, never TMDB directly
netlify/functions/tmdb.js     serverless function that holds the API key and proxies TMDB
netlify.toml                  tells Netlify where the functions and site root are
.env.example                  template for local environment variables
```

## Local development

1. Install the [Netlify CLI](https://docs.netlify.com/cli/get-started/): `npm install -g netlify-cli`
2. Copy `.env.example` to `.env` and paste in your TMDB API key (the "API Key (v3 auth)" value from [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)).
3. Run `netlify dev`. This serves the static site *and* runs the function locally, reading `TMDB_API_KEY` from `.env`.
4. Open the local URL it prints (usually `http://localhost:8888`).

Opening `index.html` directly in a browser (without `netlify dev`) won't work — there's no server to run the function, so `/.netlify/functions/tmdb` won't resolve.

## Deploying to Netlify

1. Push this repo to GitHub.
2. In Netlify, **Add new site → Import an existing project**, and connect the repo.
3. Build settings: no build command needed, publish directory `.` (already set in `netlify.toml`).
4. Go to **Site configuration → Environment variables** and add:
   - Key: `TMDB_API_KEY`
   - Value: your TMDB API key
5. Deploy. Netlify picks up `netlify.toml` automatically and deploys the function alongside the static site.

Every visitor now gets a working site with no key of their own to enter — TMDB requests are proxied through your function using the key stored in Netlify.

## Tech

Plain HTML, CSS, and vanilla JavaScript on the frontend; a single Netlify Function (Node) on the backend. No frameworks, no client-side dependencies.

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.

## License

MIT — do whatever you like with it.
