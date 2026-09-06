let stage = document.querySelector(".cf-stage");
let items = Array.from(stage.querySelectorAll(".cf-item"));
let caption = document.querySelector(".cf-caption");
let coverflow = document.querySelector(".coverflow");
let prev = document.querySelector(".cf-prev");
let next = document.querySelector(".cf-next");

let active = Math.floor(items.length / 2);
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
}

let go = (index) => {
    active = Math.max(0, Math.min(items.length - 1, index));
    layout();
}

prev.addEventListener("click", () => go(active - 1));
next.addEventListener("click", () => go(active + 1));

document.addEventListener("keydown", (e) => {
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
    if (item) go(items.indexOf(item));
})

window.addEventListener("resize", layout);

layout();
