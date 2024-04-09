
function Welcome(){
    var userLang = navigator.language || navigator.userLanguage;
    console.log(window.location.pathname)
    if(userLang.toLowerCase() === 'pt-br'){if(window.location.pathname.includes('en')){window.location='./'}}
    else if(!window.location.pathname.includes('en')){window.location='en.html'}
    removeLoader()
    document.title = "John Vitor"
    document.getElementById('anim1').classList.remove('enteranimation1')
    document.getElementById('anim2').classList.remove('enteranimation2')
    document.getElementById('anim3').classList.remove('enteranimation3')
    document.getElementById('anim4').classList.remove('enteranimation4')
}
function removeLoader(){

    setTimeout(()=>{
            let loader = document.getElementById('loader');

            // hide the loader
            loader.style = 'display: none;';
        },
        1);
}

function copy(){
    var copyText = document.getElementById('call');copyText.select();copyText.setSelectionRange(0, 99999);navigator.clipboard.writeText(copyText.value);var copy = document.getElementById('copy');copy.innerHTML = 'COPIADO!';setTimeout(function (){copy.innerHTML = '+55 19 988760900 <i class=\'fa-solid fa-copy\'></i>'},2000)
}

function vclick(which, a, bool){
    if(bool){
        a.play()
        document.getElementById('vid'+which).onclick=function (){vclick(which, a, false)}
        document.getElementById('play'+which).onclick=function (){vclick(which, a, false)}
        document.getElementById('play'+which).innerHTML='<i class="fa-solid fa-play"></i>'
    }
    else{
        a.pause()
        document.getElementById('vid'+which).onclick=function (){vclick(which, a, true)}
        document.getElementById('play'+which).onclick=function (){vclick(which, a, true)}
        document.getElementById('play'+which).innerHTML='<i class="fa-solid fa-pause"></i>'
    }
}