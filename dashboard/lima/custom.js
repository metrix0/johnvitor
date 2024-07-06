var valoresCategorias = [
    [0,1],
    [0,1],
    [0,1],
    [0,1],
    [0,1],
    [0,1],
] // matriz com [categoria do problema][se é porcentagem ou bruto]

var cellphones = [
    {
        "name": 'iPhone 13 Plus',
        "price": 2500.00,
    },
    {
        "name": 'iPhone 14 Pro',
        "price": 2500.00,
    },
    {
        "name": 'iPhone XR',
        "price": 2500.00,
    },
]

var phoneNames = document.getElementById('cellphoneNames')
var phonePrices = document.getElementById('cellphonePrices')
var phoneTrashes = document.getElementById('cellphoneTrashes')

function START(){
    console.log('staritng')
    for(let i = 0; i < valoresCategorias.length; i++){
        parseEachList1(valoresCategorias[i], i)
    }
    for(let i = 0; i < cellphones.length; i++){
        appendPhone(i)
    }
}
function parseEachList1(Categoria, n){
    var input = document.getElementById('1#leftInput:'+n);
    var btn1 = document.getElementById('1#leftBtn:'+n+'-0');
    var btn2 = document.getElementById('1#leftBtn:'+n+'-1');
    input.value = parseFloat(Categoria[0]).toFixed(2)
    clickBtn(Categoria[1],n, '1#leftBtn:')
}


function appendPhone(i){
    const phone = cellphones[i]
    let span = document.createElement("span");
    span.innerHTML = phone.name+"<br>"
    phoneNames.appendChild(span)
    let span2 = document.createElement("span");
    span2.innerHTML = 'R$ <input onkeyup="updatePricePhones(this)" id="PhonesPrice:'+i+'" style="width: 50%; text-align: right" class="changeable" value="'+parseFloat(phone.price).toFixed(2)+'"><br>'
    phonePrices.appendChild(span2)
    let span3 = document.createElement("span");
    span3.innerHTML = '<i onclick="throwaway(this)" id="PhonesTrash:'+i+'" class="fa-solid fa-trash typebutton"></i><br>'
    phoneTrashes.appendChild(span3)
}

function addDevice(){
    closeWindows()
    var place = document.getElementById('phonename')
    cellphones.push({
        "name" : place.value,
        "price" : 0,
    })
    place.value = ''
    appendPhone(cellphones.length-1)
}