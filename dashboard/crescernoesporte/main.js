
function mobilecheck() {
    let check = false;
    (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
    return check;
}
function Welcome(){

    let time = 1
    if (mobilecheck() === true){time = 600}
    setTimeout(function (){
        removeLoader()
    },time)

}
function removeLoader(){

    setTimeout(()=>{
            let loader = document.getElementById('loader');

            // hide the loader
            loader.style = 'display: none;';
        },
        1);
}


function openForm(name, window){
    const input = document.getElementById('phonename')
    document.getElementById('add').innerHTML = 'ADICIONAR '+name.toUpperCase();
    document.getElementById('phonename').placeholder = 'Nome do(a) '+name
    document.getElementById('addbutton').onclick = function (){
        addSomething(name, input.value)
    }
    openWindow(window)
    input.value = ""
}


function openWindow(window){
    let black = document.getElementById('black')
    black.classList.remove('none');
    setTimeout(function (){black.style.opacity = 0.8},30)
    window.classList.remove('none');
    setTimeout(function (){window.classList.remove('hiddencfg')},30)
}

function closeWindows(){
    let black = document.getElementById('black')
    let arr = document.getElementsByClassName('WINDOW');
    for(let i = 0; i < arr.length; i++){
        arr[i].classList.add('hiddencfg');
        black.style.opacity = '0';
        setTimeout(function (){arr[i].classList.add('none');
            black.classList.add('none')},500)
    }
}

function updateList(input){
    modified = true
    var obj = Crescer[input.id.split('.')[0]]
    obj[input.id.split('-')[1]][input.id.split('.')[1].split('-')[0]] = input.value
}

function throwaway(which){
    modified = true
    var num = which.id.split("Trash-")[1];
    var what = which.id.split("Trash")[0];
    if(confirm("Você tem certeza que deseja DELETAR "+Crescer[what][num].name+"?")){
        Crescer[what].splice(num, 1)
        const place = document.getElementById(what+'s').children
        for(let i = 0; i < place.length; i++){
            place[i].children[num].remove()
        }
    }
    else{}

}

const input = document.getElementById('input')

const baseUrl = 'https://jvapivercel.vercel.app/'

window.addEventListener('load',getInfo)
document.getElementById('save1').addEventListener('click', postInfo)

var tfirst = true;

async function getInfo(e){
    e.preventDefault()
    const res = await fetch(baseUrl + 'info/crescerNoEsporte?key=all', {
        method: 'GET'
    })
    const data = await res.json()
    console.log(data);
    Crescer = JSON.parse(data.info)
    START()
}

async function postInfo(e){
    e.preventDefault()
    //if (input.value === ''){return }
    const res = await fetch(baseUrl + 'post/crescerNoEsporte', {
        method: 'POST',
        headers: {
            "content-type": 'application/json'
        },
        body: JSON.stringify({
            parcel: Crescer
        })
    })
    if(res.status === 200){
        modified = false
        popUp(true)
    }
    else{
        popUp(false)
    }
}

function discardChanges(){
    if(confirm("Você tem certeza que deseja descartar as mudanças?")){
        window.location.reload()
    }
}

function gpopup(obj){
    obj.classList.remove('errortransition')
    setTimeout(function () {
        obj.classList.add('errortransition')
    }, 5000)
}
function popUp(bool){
    if(bool) {
        document.getElementById('Popup').classList.remove('errortransition')
        setTimeout(function () {
            document.getElementById('Popup').classList.add('errortransition')
        }, 5000)
    }
    else{
        document.getElementById('Popup2').classList.remove('errortransition')
        setTimeout(function () {
            document.getElementById('Popup2').classList.add('errortransition')
        }, 5000)
    }
}
