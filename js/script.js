(function () {
  const IMG = 'https://image.tmdb.org/t/p/';
  const PROXY = '/.netlify/functions/tmdb';
  let currentList = 'popular';
  let searchMode = false;
  let searchDebounce = null;

  const grid = document.getElementById('grid');
  const stateMsg = document.getElementById('stateMsg');
  const listTitle = document.getElementById('listTitle');
  const heroTitle = document.getElementById('heroTitle');
  const heroSub = document.getElementById('heroSub');
  const tabs = document.getElementById('tabs');
  const modalBackdrop = document.getElementById('modalBackdrop');
  const modal = document.getElementById('modal');

  const listMeta = {
    popular: { title: 'Popular', hero: "What's worth watching tonight?", sub: "Browse what's popular, trending, or top-rated right now — pulled live from The Movie Database." },
    top_rated: { title: 'Top rated', hero: 'The ones people rate highest.', sub: "All-time favorites, ranked by TMDB's user ratings." },
    now_playing: { title: 'In theaters', hero: 'Currently on the big screen.', sub: 'Films playing in theaters right now.' },
    upcoming: { title: 'Upcoming', hero: "What's coming next.", sub: "Films that haven't released yet — mark your calendar." }
  };

  function skeletonCards(n) {
    grid.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const d = document.createElement('div');
      d.className = 'card';
      d.innerHTML = '<div class="poster-wrap skeleton"></div><div class="card-body"><div class="skeleton" style="height:12px;border-radius:4px;margin-bottom:6px;"></div><div class="skeleton" style="height:10px;width:40%;border-radius:4px;"></div></div>';
      grid.appendChild(d);
    }
  }

  // Every TMDB call goes through our own serverless function, which holds
  // the real API key server-side. The browser never sees it.
  async function tmdb(path, params) {
    const url = new URL(PROXY, window.location.origin);
    url.searchParams.set('path', path);
    for (const k in (params || {})) url.searchParams.set(k, params[k]);
    const res = await fetch(url.toString());
    if (!res.ok) {
      const err = new Error('TMDB request failed');
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  function posterCard(movie) {
    const card = document.createElement('div');
    card.className = 'card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', movie.title);

    const posterWrap = document.createElement('div');
    posterWrap.className = 'poster-wrap';
    if (movie.poster_path) {
      const img = document.createElement('img');
      img.src = IMG + 'w342' + movie.poster_path;
      img.alt = movie.title;
      img.loading = 'lazy';
      posterWrap.appendChild(img);
    } else {
      const na = document.createElement('div');
      na.className = 'no-art';
      na.textContent = movie.title;
      posterWrap.appendChild(na);
    }
    if (movie.vote_average) {
      const chip = document.createElement('div');
      chip.className = 'rating-chip';
      chip.textContent = '★ ' + movie.vote_average.toFixed(1);
      posterWrap.appendChild(chip);
    }
    card.appendChild(posterWrap);

    const body = document.createElement('div');
    body.className = 'card-body';
    const year = (movie.release_date || '').slice(0, 4);
    body.innerHTML = '<p class="card-title">' + escapeHtml(movie.title) + '</p><p class="card-year">' + (year || '—') + '</p>';
    card.appendChild(body);

    const open = () => openMovie(movie.id);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });

    return card;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  async function loadList(list) {
    currentList = list;
    searchMode = false;
    document.getElementById('searchInput').value = '';
    const meta = listMeta[list];
    listTitle.textContent = meta.title;
    heroTitle.textContent = meta.hero;
    heroSub.textContent = meta.sub;
    [...tabs.children].forEach(t => t.classList.toggle('active', t.dataset.list === list));

    skeletonCards(10);
    stateMsg.style.display = 'none';
    try {
      const data = await tmdb('/movie/' + list);
      renderResults(data.results, 'Nothing here right now.');
    } catch (e) {
      handleError(e);
    }
  }

  async function runSearch(q) {
    searchMode = true;
    listTitle.textContent = 'Results for "' + q + '"';
    [...tabs.children].forEach(t => t.classList.remove('active'));
    skeletonCards(10);
    stateMsg.style.display = 'none';
    try {
      const data = await tmdb('/search/movie', { query: q });
      renderResults(data.results, 'No movies found for "' + q + '".');
    } catch (e) {
      handleError(e);
    }
  }

  function renderResults(results, emptyMsg) {
    grid.innerHTML = '';
    if (!results || results.length === 0) {
      stateMsg.textContent = emptyMsg;
      stateMsg.style.display = 'block';
      return;
    }
    stateMsg.style.display = 'none';
    results.forEach(m => grid.appendChild(posterCard(m)));
  }

  function handleError(e) {
    grid.innerHTML = '';
    stateMsg.textContent = e.status === 500
      ? 'The server is missing its TMDB API key. Check the site\'s environment variables.'
      : 'Something went wrong reaching TMDB. Check your connection and try again.';
    stateMsg.style.display = 'block';
  }

  async function openMovie(id) {
    modalBackdrop.classList.add('open');
    modal.innerHTML = '<button class="modal-close" id="modalCloseBtn" aria-label="Close">✕</button><div style="padding:60px;text-align:center;color:var(--ink-dim);">Loading…</div>';
    document.body.style.overflow = 'hidden';
    wireModalClose();

    try {
      const [movie, credits] = await Promise.all([
        tmdb('/movie/' + id),
        tmdb('/movie/' + id + '/credits')
      ]);
      renderModal(movie, credits);
    } catch (e) {
      modal.innerHTML = '<button class="modal-close" id="modalCloseBtn" aria-label="Close">✕</button><div style="padding:60px;text-align:center;color:var(--ink-dim);">Couldn\'t load this title.</div>';
      wireModalClose();
    }
  }

  function renderModal(movie, credits) {
    const year = (movie.release_date || '').slice(0, 4);
    const runtime = movie.runtime ? Math.floor(movie.runtime / 60) + 'h ' + (movie.runtime % 60) + 'm' : null;
    const genres = (movie.genres || []).map(g => '<span class="genre-pill">' + escapeHtml(g.name) + '</span>').join('');
    const cast = (credits.cast || []).slice(0, 10).map(c => {
      const img = c.profile_path
        ? '<img src="' + IMG + 'w185' + c.profile_path + '" alt="' + escapeHtml(c.name) + '">'
        : '<div class="no-headshot">' + escapeHtml((c.name || '?').charAt(0)) + '</div>';
      return '<div class="cast-item">' + img + '<div class="name">' + escapeHtml(c.name) + '</div><div class="role">' + escapeHtml(c.character || '') + '</div></div>';
    }).join('');

    const backdropImg = movie.backdrop_path
      ? '<img class="modal-backdrop-img" src="' + IMG + 'w780' + movie.backdrop_path + '" alt="">'
      : (movie.poster_path ? '<img class="modal-backdrop-img" src="' + IMG + 'w780' + movie.poster_path + '" alt="" style="object-position:center 20%;">' : '<div class="modal-backdrop-img"></div>');

    modal.innerHTML =
      '<button class="modal-close" id="modalCloseBtn" aria-label="Close">✕</button>' +
      '<div class="modal-hero">' + backdropImg + '</div>' +
      '<div class="modal-content">' +
        '<h2 class="display">' + escapeHtml(movie.title) + '</h2>' +
        (movie.tagline ? '<p class="modal-tagline">' + escapeHtml(movie.tagline) + '</p>' : '') +
        '<div class="modal-meta">' +
          (year ? '<span><strong>' + year + '</strong></span>' : '') +
          (runtime ? '<span>' + runtime + '</span>' : '') +
          (movie.vote_average ? '<span>★ ' + movie.vote_average.toFixed(1) + ' / 10</span>' : '') +
          '</div>' +
        (genres ? '<div class="modal-meta">' + genres + '</div>' : '') +
        '<p class="modal-overview">' + escapeHtml(movie.overview || 'No overview available.') + '</p>' +
        (cast ? '<p class="subhead">Cast</p><div class="cast-row">' + cast + '</div>' : '') +
      '</div>';

    wireModalClose();
  }

  function wireModalClose() {
    document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
  }

  function closeModal() {
    modalBackdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (btn) loadList(btn.dataset.list);
  });

  document.getElementById('logoBtn').addEventListener('click', () => loadList('popular'));

  document.getElementById('searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = document.getElementById('searchInput').value.trim();
    if (q) runSearch(q); else loadList(currentList);
  });

  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    const q = e.target.value.trim();
    searchDebounce = setTimeout(() => {
      if (q.length >= 2) runSearch(q);
      else if (q.length === 0 && searchMode) loadList('popular');
    }, 450);
  });

  // Boot
  loadList('popular');
})();
