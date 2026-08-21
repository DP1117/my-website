let sections = document.querySelectorAll('.reveal');

window.onload = () =>{
    animate();
}

window.onscroll = () => {
    animate();
}

function animate(){
    let trigger = window.innerHeight * 0.85;
    sections.forEach(sec => {
        let top = sec.getBoundingClientRect().top;
        let bottom = sec.getBoundingClientRect().bottom;

        if (top < trigger && bottom > 0) {
            sec.classList.add('show-animate');
        }
        else{
            sec.classList.remove('show-animate');
        }
    })
}

let identityList = ["Software Developer", "Math/CS Teacher", 
    "Programming Enthusiast", "Basketball Player", "Violinist", "Wrestler"]
let identitySpan = document.querySelector(".identity-list");

let animText = () => {
    for(let i = 0; i < identityList.length; i++){
        setTimeout(() => {
            identitySpan.textContent = identityList[i];
        }, i * 4000)
    }
}

animText();
setInterval(animText, identityList.length * 4000);