/* ---------------------------------------------------------------------------
   The iPod shell. Every page is a screen that slides into the same stage, so
   moving around the site pushes and pops menus instead of loading pages.

   Nothing here is load bearing: each screen is still a plain linked HTML file,
   and with scripting off the links just navigate the ordinary way.
   --------------------------------------------------------------------------- */

const bar = document.querySelector('.ipod-bar');
const titleEl = document.querySelector('.ipod-title');
const backEl = document.querySelector('.ipod-back');
const stage = document.querySelector('.ipod-stage');
const hintEl = document.querySelector('.ipod-hint');

/* Screens with behaviour of their own register here - see gallery.js. Each is
   called with its screen element and an abort signal that fires when the
   screen leaves, so listeners can be handed over with { signal }. */
window.ipodScreens = window.ipodScreens || {};

/* let a screen retitle the status bar, the way the photo viewer showed 3 of 35 */
window.ipodTitle = (text) => { titleEl.textContent = text; };

let current = stage.querySelector('.ipod-screen');
let mounted = null;
/* how many screens deep this visit has pushed, mirrored into history state so
   popstate can tell which way the user went */
let depth = 0;
let busy = false;

/* A frame, or 50ms, whichever lands first. Animation frames stop being
   delivered in a background tab, and a navigation that sat waiting on one
   would never finish - the fallback keeps the slide moving either way. */
const frame = () => new Promise(resolve => {
    let done = false;
    const go = () => {
        if (done) return;
        done = true;
        resolve();
    };

    requestAnimationFrame(go);
    setTimeout(go, 50);
});
const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));

document.documentElement.classList.remove('no-js');

/* --- fetching ahead ------------------------------------------------------ */

/* The slide can only be as smooth as the thing it is waiting on, so screens
   are fetched before they are asked for - on hover, on focus, on the menu
   highlight landing, and for whatever the current screen links to once the
   browser goes idle. The whole site is a handful of small files. */
const cache = new Map();

const fetchScreen = (url) => {
    if (cache.has(url)) return cache.get(url);

    const job = fetch(url)
        .then(res => {
            if (!res.ok) throw new Error(res.status);
            return res.text();
        })
        .then(text => new DOMParser().parseFromString(text, 'text/html'))
        .catch(err => {
            // a failed fetch must not poison the entry for the next attempt
            cache.delete(url);
            throw err;
        });

    cache.set(url, job);
    if (cache.size > 8) cache.delete(cache.keys().next().value);

    return job;
};

// where a link points, if it is one of ours
/* Copy-to-clipboard rows. An address is more use on the clipboard than handed
   to whatever mail client the browser has been told to open. */
const copyText = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    }
    catch {
        // the clipboard API needs a secure context, which a file:// or plain
        // http page is not - fall back to the old selection trick
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
        document.body.appendChild(ta);
        ta.select();

        let ok = false;
        try { ok = document.execCommand('copy'); } catch {}
        ta.remove();
        return ok;
    }
};

const flashCopied = (row, ok) => {
    if (row.dataset.flashing) return;
    row.dataset.flashing = '1';

    const chev = row.querySelector('.ipod-chev');
    const sub = document.getElementById(row.dataset.preview || '')?.querySelector('.ipod-card-sub');
    // innerHTML, not textContent: the copy chevron is an inline SVG and a text
    // swap would throw it away and restore an empty span
    const chevWas = chev?.innerHTML;
    const subWas = sub?.innerHTML;

    if (chev) chev.textContent = ok ? '\u2713' : '!';
    if (sub) sub.textContent = ok ? 'Copied to clipboard' : 'Could not copy - select it by hand';

    setTimeout(() => {
        if (chev) chev.innerHTML = chevWas;
        if (sub) sub.innerHTML = subWas;
        delete row.dataset.flashing;
    }, 1700);
};

const localHref = (a) => {
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return null;

    // menu rows are not always anchors - a course row is a plain div, since
    // selecting it only moves the preview and there is nothing to open
    const href = a.getAttribute?.('href');
    if (!href) return null;

    const url = new URL(href, location.href);
    return url.origin === location.origin ? url.href : null;
};

const prefetch = (url) => {
    if (url) fetchScreen(url).catch(() => {});
};

/* --- menus --------------------------------------------------------------- */

const wireMenu = (screen, signal) => {
    const rows = [...screen.querySelectorAll('.ipod-row')];
    if (!rows.length) return;

    const cards = [...screen.querySelectorAll('.ipod-card')];
    let sel = 0;

    const select = (i, scroll = true) => {
        // wrap around the ends, the way the click wheel did
        sel = (i + rows.length) % rows.length;
        rows.forEach((row, n) => row.classList.toggle('is-sel', n === sel));

        const want = rows[sel].dataset.preview;
        cards.forEach(card => card.classList.toggle('is-shown', card.id === want));

        // skipped on the opening call: the screen is still parked off stage
        // then, and scrolling anything into view would jolt it
        if (scroll) rows[sel].scrollIntoView({ block: 'nearest' });

        prefetch(localHref(rows[sel]));
    };

    select(0, false);

    // hover and focus move the highlight too, so mouse and keyboard never disagree
    rows.forEach((row, n) => {
        row.addEventListener('mouseenter', () => select(n), { signal });
        row.addEventListener('focus', () => select(n), { signal });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            select(sel + 1);
        }
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            select(sel - 1);
        }
        else if (e.key === 'Enter') {
            // preventDefault stops the browser firing its own click on a
            // focused row, which would otherwise navigate twice
            e.preventDefault();
            rows[sel].click();
        }
    }, { signal });
};

/* the rotating job title - the word is swapped on animationiteration, at the
   moment the fade has it invisible, so the two never drift apart */
const wireIdentity = (screen, signal) => {
    const el = screen.querySelector('.identity-list');
    if (!el) return;

    const words = (el.dataset.words || '').split('|').filter(Boolean);
    if (words.length < 2) return;

    let i = 0;
    el.textContent = words[0];

    el.addEventListener('animationiteration', () => {
        i = (i + 1) % words.length;
        el.textContent = words[i];
    }, { signal });
};

/* the strip along the bottom, standing in for the wheel. Each screen says
   which keys it actually answers to: "keys;label" items, pipe separated. */
const DEFAULT_HINT = '↑ ↓;browse|↵;select|esc;menu';

const wireHint = (screen) => {
    if (!hintEl) return;

    hintEl.textContent = '';

    (screen.dataset.hint || DEFAULT_HINT).split('|').filter(Boolean).forEach(part => {
        const [keys = '', label = ''] = part.split(';');
        const item = document.createElement('span');

        keys.trim().split(/\s+/).filter(Boolean).forEach(key => {
            const kbd = document.createElement('kbd');
            kbd.textContent = key;
            item.append(kbd, ' ');
        });

        item.append(label);
        hintEl.append(item);
    });
};

/* --- mounting ------------------------------------------------------------ */

const mount = (screen) => {
    const ctl = new AbortController();

    titleEl.textContent = screen.dataset.title || '';
    // restart the fade so the new title arrives rather than snapping in
    titleEl.style.animation = 'none';
    titleEl.offsetHeight;
    titleEl.style.animation = '';

    const parent = screen.dataset.parent || '';
    backEl.hidden = !parent;
    if (parent) backEl.setAttribute('href', parent);

    wireHint(screen);
    wireMenu(screen, ctl.signal);
    wireIdentity(screen, ctl.signal);
    window.ipodScreens[screen.dataset.screen]?.(screen, ctl.signal);

    // warm everything this screen can reach, once the browser has nothing
    // better to do - including the way back out
    idle(() => {
        if (ctl.signal.aborted) return;
        if (parent) prefetch(new URL(parent, location.href).href);
        screen.querySelectorAll('a[href]').forEach(a => prefetch(localHref(a)));
    });

    return ctl;
};

/* --- the router ---------------------------------------------------------- */

const navigate = async (url, dir, push) => {
    if (busy) return;
    busy = true;

    let doc;
    try {
        doc = await fetchScreen(url);
    }
    catch {
        // anything unexpected and we hand the URL back to the browser
        location.href = url;
        return;
    }

    const source = doc.querySelector('.ipod-screen');
    if (!source) {
        location.href = url;
        return;
    }

    // the cached document keeps its own copy: appending the original would
    // move it out, and leave nothing to show the next time round
    const next = source.cloneNode(true);
    const old = current;
    const back = dir === 'back';

    // Park the new screen off the edge and do all of its setup there. The
    // gallery lays out thirty-five covers on mount, and that is not work you
    // want landing in the same frame the slide is trying to start.
    next.classList.add('is-sliding', back ? 'from-left' : 'from-right');
    old.classList.add('is-sliding');
    stage.appendChild(next);

    document.title = doc.title;
    current = next;
    mounted?.abort();
    mounted = mount(next);

    // A screen may ask for a moment to get itself ready - the gallery uses it
    // to decode the cover you will be looking at - but it never gets to hold
    // the slide up for long enough to feel like a stall.
    if (next.ipodReady) {
        await Promise.race([next.ipodReady, new Promise(r => setTimeout(r, 180))]);
    }

    // one frame to paint the parked screen and whatever mount() just did,
    // one more so the slide begins on a clean budget
    await frame();
    await frame();

    next.classList.remove('from-left', 'from-right');
    old.classList.add(back ? 'to-right' : 'to-left');

    if (push) history.pushState({ depth: ++depth }, '', url);

    setTimeout(() => {
        old.remove();
        next.classList.remove('is-sliding');
        busy = false;
    }, 360);
};

const goBack = () => {
    // the parent screen is almost always the one behind us in history, so let
    // the browser walk back and keep the entry count honest
    if (depth > 0) history.back();
    else if (backEl.getAttribute('href')) {
        navigate(new URL(backEl.getAttribute('href'), location.href).href, 'back', true);
    }
};

/* hover, focus and the press itself all start the fetch early - by the time
   the click lands the screen is usually already in hand */
['mouseover', 'focusin', 'pointerdown'].forEach(type => {
    document.addEventListener(type, (e) => {
        prefetch(localHref(e.target.closest?.('a[href]')));
    }, { passive: true });
});

document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    // a modified click means the user wants a tab or a download, not a screen
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    // a row that carries an address copies it rather than navigating
    const copyRow = e.target.closest?.('[data-copy]');
    if (copyRow) {
        e.preventDefault();
        copyText(copyRow.dataset.copy).then(ok => flashCopied(copyRow, ok));
        return;
    }

    const a = e.target.closest?.('a[href]');
    // mailto: and anything off site keep their normal behaviour
    const href = localHref(a);
    if (!href) return;

    e.preventDefault();

    if (a.classList.contains('ipod-back')) goBack();
    else navigate(href, 'forward', true);
});

window.addEventListener('popstate', (e) => {
    const to = e.state?.depth ?? 0;
    const dir = to < depth ? 'back' : 'forward';
    depth = to;
    navigate(location.href, dir, false);
});

/* Menu keys live on window so they run after the document level handlers a
   screen installs - if the gallery has already claimed Escape for its viewer
   it will have called preventDefault and we stay out of the way. */
window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || backEl.hidden) return;
    if (e.key !== 'Escape' && e.key !== 'Backspace' && e.key !== 'ArrowLeft') return;
    if (e.target.matches?.('input, textarea, select')) return;

    e.preventDefault();
    goBack();
});

history.replaceState({ depth: 0 }, '');
mounted = mount(current);
