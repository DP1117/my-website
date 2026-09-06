let stage = document.querySelector(".cf-stage");
let items = Array.from(stage.querySelectorAll(".cf-item"));
let caption = document.querySelector(".cf-caption");
let coverflow = document.querySelector(".coverflow");

let active = Math.floor(items.length / 2);

let layout = () => {
    let size = items[0].offsetWidth;

    items.forEach((item, i) => {
        let offset = i - active;
        let dist = Math.abs(offset);
        let dir = Math.sign(offset);

        let x = dir * (size * 0.5 + (dist - 1) * size * 0.22);
        let z = dist === 0 ? 0 : -size * 0.6 - (dist - 1) * size * 0.12;

        item.style.transform = `translateX(${dist === 0 ? 0 : x}px) translateZ(${z}px) rotateY(${-dir * 58}deg)`;
        item.style.opacity = dist > 4 ? 0 : 1;
        item.style.pointerEvents = dist > 4 ? "none" : "auto";
        item.classList.toggle("is-active", offset === 0);
    });

    caption.textContent = items[active].dataset.title;
}

let go = (index) => {
    active = Math.max(0, Math.min(items.length - 1, index));
    layout();
}

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
