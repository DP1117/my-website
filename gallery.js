/* ---------------------------------------------------------------------------
   Cover flow for the gallery screen.

   Registered with the shell rather than run on load, so it is set up again
   every time the screen slides in and torn down when it slides out - every
   listener below is handed the screen's abort signal.
   --------------------------------------------------------------------------- */

window.ipodScreens = window.ipodScreens || {};

window.ipodScreens.gallery = (screen, signal) => {
    const coverflow = screen.querySelector('.coverflow');
    const stage = screen.querySelector('.cf-stage');
    const prev = screen.querySelector('.cf-prev');
    const next = screen.querySelector('.cf-next');
    const lightbox = screen.querySelector('.cf-lightbox');
    const lightboxImg = screen.querySelector('.cf-lightbox-img');

    const items = [...stage.querySelectorAll('.cf-item')];
    if (!items.length) return;

    // deal the deck in a fresh order every visit, then open on the first cover
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    items.forEach(item => stage.appendChild(item));

    let active = 0;
    // covers shown either side of the centre one - 2 + 1 + 2 = 5 on screen
    const reach = 2;
    // how far past those to fetch ahead, and how far out to drop one again
    const buffer = 2;
    const release = 6;

    // only covers near the middle carry a src, so first paint costs the same
    // whether the deck holds six photos or three hundred
    const load = () => {
        items.forEach((item, i) => {
            const img = item.querySelector('img');
            const dist = Math.abs(i - active);

            if (dist <= reach + buffer) {
                if (!img.src) img.src = img.dataset.src;
            }
            else if (dist > release && img.src) {
                // the browser cache hands it straight back on the way in
                img.removeAttribute('src');
            }
        });
    };

    const layout = () => {
        const size = items[0].offsetWidth;

        load();

        items.forEach((item, i) => {
            const offset = i - active;
            const dist = Math.abs(offset);
            const dir = Math.sign(offset);

            const x = dir * (size * 0.5 + (dist - 1) * size * 0.22);
            const z = dist === 0 ? 0 : -size * 0.6 - (dist - 1) * size * 0.12;

            item.style.transform = `translateX(${dist === 0 ? 0 : x}px) translateZ(${z}px) rotateY(${-dir * 58}deg)`;
            item.classList.toggle('is-near', dist <= reach);
            item.classList.toggle('is-active', offset === 0);
        });

        // the status bar carries the count, the way the photo viewer did
        window.ipodTitle?.(`Gallery  ${active + 1} of ${items.length}`);

        prev.disabled = active === 0;
        next.disabled = active === items.length - 1;

        // arrow keys keep an open viewer in step with the deck
        if (!lightbox.hidden) showFull();
    };

    const go = (index) => {
        active = Math.max(0, Math.min(items.length - 1, index));
        layout();
    };

    /* --- full screen viewer ---------------------------------------------- */

    const showFull = () => {
        const item = items[active];

        lightboxImg.src = item.querySelector('img').dataset.full;
        lightboxImg.alt = item.dataset.title || '';
    };

    const openLightbox = () => {
        showFull();
        lightbox.hidden = false;
        // paint the closed state first, otherwise there is nothing to fade from
        requestAnimationFrame(() => lightbox.classList.add('is-open'));
    };

    const closeLightbox = () => {
        if (lightbox.hidden) return;

        lightbox.classList.remove('is-open');

        setTimeout(() => {
            if (lightbox.classList.contains('is-open')) return;

            lightbox.hidden = true;
            // hand the full size photo back rather than hold it in memory
            lightboxImg.removeAttribute('src');
        }, 300);
    };

    lightbox.addEventListener('click', (e) => {
        if (e.target !== lightboxImg) closeLightbox();
    }, { signal });

    prev.addEventListener('click', () => go(active - 1), { signal });
    next.addEventListener('click', () => go(active + 1), { signal });

    /* Every key this screen consumes is marked handled, so the shell knows not
       to read the same press as a step back to the menu. */
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // only ours while the viewer is up; otherwise Escape means Menu
            if (lightbox.hidden) return;
            e.preventDefault();
            closeLightbox();
        }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (lightbox.hidden) openLightbox();
            else closeLightbox();
        }
        else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            go(active - 1);
        }
        else if (e.key === 'ArrowRight') {
            e.preventDefault();
            go(active + 1);
        }
    }, { signal });

    /* --- pointer: flick to scrub, tap the centre cover to open ----------- */

    let startX = null;

    coverflow.addEventListener('pointerdown', (e) => {
        startX = e.clientX;
    }, { signal });

    coverflow.addEventListener('pointerup', (e) => {
        if (startX === null) return;

        const moved = e.clientX - startX;
        startX = null;

        if (Math.abs(moved) > 40) {
            go(active + (moved < 0 ? 1 : -1));
            return;
        }

        const item = e.target.closest('.cf-item');
        if (!item) return;

        const index = items.indexOf(item);
        // the one already facing you opens; the rest step into place
        if (index === active) openLightbox();
        else go(index);
    }, { signal });

    window.addEventListener('resize', layout, { signal });

    // Deal the shelf with transitions suppressed: the screen is still parked
    // off stage at this point, so the covers should simply already be in place
    // when it slides in, not animate their way there during it.
    stage.classList.add('no-anim');
    layout();
    stage.getBoundingClientRect();
    stage.classList.remove('no-anim');

    /* The router waits on this, briefly, before it starts the slide. Decoding a
       1200x900 cover takes long enough to show, and a cover popping in halfway
       through the transition is exactly what made this screen feel worse than
       the others. Only the centre one is worth waiting for. */
    const centre = items[active].querySelector('img');
    screen.ipodReady = centre.decode ? centre.decode().catch(() => {}) : null;
};
