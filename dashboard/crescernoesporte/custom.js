let modified = false
window.onbeforeunload = s => modified ? "" : null;

var Crescer =
    {
        'banner': [
            {
                'src': 'a.g'
            },
            {
                'src': 's.s'
            },
            {
                'src': 'a.png'
            },
        ],
        'vaga': [
            {
                "name": "Psicologo",
                "desc": "Descrição",
                "vaga": "1",
                "tempo": "12 meses",
            }
        ],
        'datachamamento': [
            {
                "data": "12/12/2024"
            }
        ],
        'parceiro': [
            {
                "name": "Tigre",
                "desc": "A Tigre tem sido uma enorme parceira há anos.",
                "logo": "tigre_logo.png",
            }
        ],
        'prestacao': [
            {
                "name": "Ata 2024",
                "data": "12/12/2024",
                "file": "ata.pdf",
            }
        ],
        'ata': [
            {
                "name": "Ata 2024",
                "data": "12/12/2024",
                "file": "ata.pdf",
            }
        ],
        'diretoria': [
            {
                "name": "Psico",
                "desc": "abc",
                "cargo": "1",
            }
        ]
    }

var vagas = document.getElementById('vagas')

var parceiros = document.getElementById('parceiros')

var prestacaos = document.getElementById('prestacaos')

var atas = document.getElementById('atas')

var diretorias = document.getElementById('diretorias')

function fillInputs(onlyUpdate){ //* 'all' for all updates. IF OnlyUpdate is 'vaga', it'll update only the vaga. If it's 'parceiros', only the parceiros.
    let innerArr = vagas.children
    if(onlyUpdate !== "all"){modified  = true}
    if(onlyUpdate === "all" || onlyUpdate === "vaga"){
        for (let j = 0; j < Crescer.vaga.length; j++){
            if(onlyUpdate === "vaga"){j = innerArr[0].children.length; onlyUpdate = null}
            let span = document.createElement("span")
            span.innerHTML = Crescer.vaga[j].name+'<br>'
            innerArr[0].appendChild(span)
            let span2 = document.createElement("span")
            span2.innerHTML = '<input id="vaga.desc-'+j+'" onkeyup="updateList(this)" value="'+Crescer.vaga[j].desc+'" placeholder="Descrição" style="width: 100%; text-align: left" class="changeable"><br>'
            innerArr[1].appendChild(span2)
            let span3 = document.createElement("span")
            span3.innerHTML = ' <input id="vaga.vaga-'+j+'" onkeyup="updateList(this)" value="'+Crescer.vaga[j].vaga+'" placeholder="1" style="width: 100%; text-align: left" class="changeable"><br>'
            innerArr[2].appendChild(span3)
            let span4 = document.createElement("span")
            span4.innerHTML = '<input id="vaga.tempo-'+j+'" onkeyup="updateList(this)" value="'+Crescer.vaga[j].tempo+'" placeholder="12 Meses" style="width: 100%; text-align: left" class="changeable"><br>'
            innerArr[3].appendChild(span4)

            let trashspan = document.createElement("span")
            trashspan.innerHTML = '<i onclick="throwaway(this)" id="vagaTrash-'+j+'" class="fa-solid fa-trash typebutton"></i><br>'
            innerArr[4].appendChild(trashspan)
        }
    }
    if(onlyUpdate === "all" || onlyUpdate === "parceiro"){
        innerArr = parceiros.children
        for (let j = 0; j < Crescer.parceiro.length; j++){
            if(onlyUpdate === "parceiro"){j = innerArr[0].children.length; onlyUpdate = null}
            let span = document.createElement("span")
            span.innerHTML = Crescer.parceiro[j].name+'<br>'
            innerArr[0].appendChild(span)
            let span2 = document.createElement("span")
            span2.innerHTML = '<input id="parceiro.desc-'+j+'" onkeyup="updateList(this)" value="'+Crescer.parceiro[j].desc+'" placeholder="Descrição" style="width: 100%; text-align: left" class="changeable"><br>'
            innerArr[1].appendChild(span2)
            let span3 = document.createElement("span")
            span3.innerHTML = ' <input id="parceiro.logo-'+j+'" onkeyup="updateList(this)" value="'+Crescer.parceiro[j].logo+'" placeholder="logo.png" style="width: 100%; text-align: left" class="changeable"><br>'
            innerArr[2].appendChild(span3)

            let trashspan = document.createElement("span")
            trashspan.innerHTML = '<i onclick="throwaway(this)" id="parceiroTrash-'+j+'" class="fa-solid fa-trash typebutton"></i><br>'
            innerArr[3].appendChild(trashspan)
        }

    }
    if(onlyUpdate === "all" || onlyUpdate === "ata"){
        innerArr = atas.children
        for (let j = 0; j < Crescer.ata.length; j++){
            if(onlyUpdate === "ata"){j = innerArr[0].children.length; onlyUpdate = null}
            let span = document.createElement("span")
            span.innerHTML = Crescer.ata[j].name+'<br>'
            innerArr[0].appendChild(span)
            let span2 = document.createElement("span")
            span2.innerHTML = '<input id="ata.data-'+j+'" onkeyup="updateList(this)" value="'+Crescer.ata[j].data+'" placeholder="12/12/2020" style="width: 100%; text-align: left" class="changeable"><br>'
            innerArr[1].appendChild(span2)
            let span3 = document.createElement("span")
            span3.innerHTML = ' <input id="ata.file-'+j+'" onkeyup="updateList(this)" value="'+Crescer.ata[j].file+'" placeholder="ata.pdf" style="width: 100%; text-align: left" class="changeable"><br>'
            innerArr[2].appendChild(span3)

            let trashspan = document.createElement("span")
            trashspan.innerHTML = '<i onclick="throwaway(this)" id="ataTrash-'+j+'" class="fa-solid fa-trash typebutton"></i><br>'
            innerArr[3].appendChild(trashspan)
        }
    }
    if(onlyUpdate === "all" || onlyUpdate === "prestacao"){
        innerArr = prestacaos.children
        for (let j = 0; j < Crescer.prestacao.length; j++){
            if(onlyUpdate === "prestacao"){j = innerArr[0].children.length; onlyUpdate = null}
            let span = document.createElement("span")
            span.innerHTML = Crescer.prestacao[j].name+'<br>'
            innerArr[0].appendChild(span)
            let span2 = document.createElement("span")
            span2.innerHTML = '<input id="prestacao.dprestacao-'+j+'" onkeyup="updateList(this)" value="'+Crescer.prestacao[j].dprestacao+'" placeholder="12/12/2020" style="width: 100%; text-align: left" class="changeable"><br>'
            innerArr[1].appendChild(span2)
            let span3 = document.createElement("span")
            span3.innerHTML = ' <input id="prestacao.file-'+j+'" onkeyup="updateList(this)" value="'+Crescer.prestacao[j].file+'" placeholder="prestacao.pdf" style="width: 100%; text-align: left" class="changeable"><br>'
            innerArr[2].appendChild(span3)

            let trashspan = document.createElement("span")
            trashspan.innerHTML = '<i onclick="throwaway(this)" id="prestacaoTrash-'+j+'" class="fa-solid fa-trash typebutton"></i><br>'
            innerArr[3].appendChild(trashspan)
        }
    }
    if(onlyUpdate === "all" || onlyUpdate === "diretoria"){
        innerArr = diretorias.children
        for (let j = 0; j < Crescer.diretoria.length; j++){
            if(onlyUpdate === "diretoria"){j = innerArr[0].children.length; onlyUpdate = null}
            let span = document.createElement("span")
            span.innerHTML = Crescer.diretoria[j].name+'<br>'
            innerArr[0].appendChild(span)
            let span2 = document.createElement("span")
            span2.innerHTML = '<input id="diretoria.desc-'+j+'" onkeyup="updateList(this)" value="'+Crescer.diretoria[j].desc+'" placeholder="Descrição" style="width: 100%; text-align: left" class="changeable"><br>'
            innerArr[1].appendChild(span2)
            let span3 = document.createElement("span")
            span3.innerHTML = ' <input id="diretoria.cargo-'+j+'" onkeyup="updateList(this)" value="'+Crescer.diretoria[j].cargo+'" placeholder="Diretor" style="width: 100%; text-align: left" class="changeable"><br>'
            innerArr[2].appendChild(span3)
            let span4 = document.createElement("span")
            span4.innerHTML = ' <input id="diretoria.logo-'+j+'" onkeyup="updateList(this)" value="'+Crescer.diretoria[j].logo+'" placeholder="Diretor" style="width: 100%; text-align: left" class="changeable"><br>'
            innerArr[3].appendChild(span4)

            let trashspan = document.createElement("span")
            trashspan.innerHTML = '<i onclick="throwaway(this)" id="diretoriaTrash-'+j+'" class="fa-solid fa-trash typebutton"></i><br>'
            innerArr[4].appendChild(trashspan)
        }
    }
}


function updateStatics(){
    var banners = document.getElementById('banners')
    let j = 0;
    for (let i = 0; i < banners.children.length; i++){
        if(banners.children[i].classList.toString() !== 'skip'){
            banners.children[i].value = Crescer.banner[j].src
            j++;
        }
    }

    var datachamamentos = document.getElementById('datachamamentos')

    j = 0;
    for (let i = 0; i < datachamamentos.children.length; i++){
        if(datachamamentos.children[i].classList.toString() !== 'skip'){
            console.log(Crescer.datachamamento[j].src)
            datachamamentos.children[i].value = Crescer.datachamamento[j].data
            j++;
        }
    }
}
function START(){
    updateStatics()
    fillInputs("all")
}

function addSomething(where, what){
    closeWindows()
    if(where === 'vaga'){
        Crescer.vaga.push({
            "name": what,
            "desc": "",
            "vaga": "",
            "tempo": "",
        })
        fillInputs("vaga")
    }
    else if(where === 'parceiro'){
        Crescer.parceiro.push({
            "name": what,
            "desc": "",
            "logo": "",
        })
        fillInputs("parceiro")
    }
    else if(where === 'prestacao'){
        Crescer.prestacao.push({
            "name": what,
            "dprestacao": "",
            "file": "",
        })
        fillInputs("prestacao")
    }
    else if(where === 'ata'){
        Crescer.ata.push({
            "name": what,
            "data": "",
            "file": "",
        })
        fillInputs("ata")
    }
    else if(where === 'membro'){
        Crescer.diretoria.push({
            "name": what,
            "desc": "",
            "cargo": "",
        })
        fillInputs("diretoria")
    }
}