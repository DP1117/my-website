let stage = document.querySelector(".cf-stage");
let items = Array.from(stage.querySelectorAll(".cf-item"));
let caption = document.querySelector(".cf-caption");
let coverflow = document.querySelector(".coverflow");
let prev = document.querySelector(".cf-prev");
let next = document.querySelector(".cf-next");
let lightbox = document.querySelector(".cf-lightbox");
let lightboxImg = document.querySelector(".cf-lightbox-img");

// deal the deck in a fresh order every visit, then open on the first cover
let shuffle = () => {
    for (let i = items.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }

    items.forEach(item => stage.appendChild(item));
}

shuffle();

let active = 0;
// covers shown either side of the centre one - 2 + 1 + 2 = 5 on screen
let reach = 2;
// how far past those to fetch ahead, and how far out to drop a cover again
let buffer = 2;
let release = 6;

// only covers near the middle carry a src, so first paint costs the same
// whether the deck holds six photos or three hundred
let load = () => {
    items.forEach((item, i) => {
        let img = item.querySelector("img");
        let dist = Math.abs(i - active);

        if (dist <= reach + buffer) {
            if (!img.src) img.src = img.dataset.src;
        }
        else if (dist > release && img.src) {
            // the browser cache hands it straight back on the way in
            img.removeAttribute("src");
        }
    });
}

let layout = () => {
    let size = items[0].offsetWidth;

    load();

    items.forEach((item, i) => {
        let offset = i - active;
        let dist = Math.abs(offset);
        let dir = Math.sign(offset);

        let x = dir * (size * 0.5 + (dist - 1) * size * 0.22);
        let z = dist === 0 ? 0 : -size * 0.6 - (dist - 1) * size * 0.12;

        item.style.transform = `translateX(${dist === 0 ? 0 : x}px) translateZ(${z}px) rotateY(${-dir * 58}deg)`;
        item.classList.toggle("is-near", dist <= reach);
        item.classList.toggle("is-active", offset === 0);
    });

    caption.textContent = items[active].dataset.title;

    prev.disabled = active === 0;
    next.disabled = active === items.length - 1;

    // arrow keys keep the open viewer in step with the deck
    if (!lightbox.hidden) showFull();
}

let go = (index) => {
    active = Math.max(0, Math.min(items.length - 1, index));
    layout();
}

// press the centre cover to see the photo full size
let showFull = () => {
    let item = items[active];

    lightboxImg.src = item.querySelector("img").dataset.full;
    lightboxImg.alt = item.dataset.title;
}

let openLightbox = () => {
    showFull();
    lightbox.hidden = false;
    // nothing behind the viewer should move while it is up
    document.body.style.overflow = "hidden";
    // paint the closed state first, otherwise there is nothing to fade from
    requestAnimationFrame(() => lightbox.classList.add("is-open"));
}

let closeLightbox = () => {
    if (lightbox.hidden) return;

    lightbox.classList.remove("is-open");

    setTimeout(() => {
        if (lightbox.classList.contains("is-open")) return;

        lightbox.hidden = true;
        document.body.style.overflow = "";
        // hand the full size photo back rather than hold it in memory
        lightboxImg.removeAttribute("src");
    }, 300);
}

lightbox.addEventListener("click", (e) => {
    if (e.target !== lightboxImg) closeLightbox();
})

prev.addEventListener("click", () => go(active - 1));
next.addEventListener("click", () => go(active + 1));

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLightbox();
    // enter presses the cover facing you, and presses back out once open,
    // unless a button has the focus and is about to be clicked anyway
    if (e.key === "Enter" && !e.target.closest?.("button")) {
        if (lightbox.hidden) openLightbox();
        else closeLightbox();
    }
    if (e.key === "ArrowLeft") go(active - 1);
    if (e.key === "ArrowRight") go(active + 1);
})

let startX = null;

coverflow.addEventListener("pointerdown", (e) => {
    startX = e.clientX;
})

coverflow.addEventListener("pointerup", (e) => {
    if (startX === null) return;

    let moved = e.clientX - startX;
    startX = null;

    if (Math.abs(moved) > 40) {
        go(active + (moved < 0 ? 1 : -1));
        return;
    }

    let item = e.target.closest(".cf-item");
    if (!item) return;

    let index = items.indexOf(item);
    // the one already facing you opens; the rest step into place
    if (index === active) openLightbox();
    else go(index);
})

window.addEventListener("resize", layout);

layout();
