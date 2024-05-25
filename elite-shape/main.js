var exerciselist= []
var addedmealslist = []
var ismobile = false
var userweight = [
]
function CookieGet(){
    let cookies = document.cookie.split(';')
    let workout = false;
    let stringed = cookies.toString()
    let foundfrequency = false;
    if(stringed.includes("Current#Workout=1")){workout = true; currentworkout.push(["1>"+stringed.split("Current#Workout=1>")[1].split(",")[0]])}
    let dietaddarray = []
    let foundid = false;
    for(let i = 0; i<cookies.length; i++){
        if(cookies[i].includes("AddedMeals=")){
            var list = cookies[i].split("AddedMeals=")[1].split(',')
            if(list.length === 1 && list[0] === ''){}
            else{addedmealslist = list}
            for (let j = 0; j < addedmealslist.length; j++){
                dietaddarray.push(parseInt(addedmealslist[j]))
            }
        }
        else if(cookies[i].includes("UserWeight=")){
            var list = cookies[i].split("UserWeight=")[1].split(',')
            for (let i = 0; i < list.length; i++){
                userweight.push(    {
                        "weight": list[i].split('!')[0],
                        "date": list[i].split('!')[1]
                    })
            }
            chart(false)
        }
        else if(workout && cookies[i].includes("CurrentWorkout")){
            currentworkout.push([
                cookies[i].split('out')[1].split("!")[0],
                cookies[i].split("!")[1].split('=')[0],
                cookies[i].split('=')[1]
            ])
        }
        else if(cookies[i].includes("CurrentWeek=")){
            document.getElementById('weekdrop').innerHTML ='WEEK '+ cookies[i].split("CurrentWeek=")[1]+' <i class="fa-solid fa-angle-down" style="margin-left: 5%; transform: translateY(10%)"></i>'
        }
        else if(cookies[i].includes("userId=")){
            foundid = true;
            updateuseridstuff(cookies[i].split("userId=")[1])
        }
        else if(cookies[i].includes("CurrentFrequency=")){
            loadworkouts(cookies[i].split('=')[1])
            foundfrequency = true
        }
    }
    if(!foundid && location.toString().includes('#!')){
        let id = location.toString().split("#!")[1]
        Cookie('userId',id)
        if(workoutlist().find(o => o.frequency === id)){
            Cookie('CurrentFrequency', id);
        }
        setTimeout(function (){window.location = '../dashboard'},300)
    }
    mobilecheck()
    if(workout){workoutupdate()}
    if(!foundfrequency){document.getElementById('loaderp1').classList.add('none');
        document.getElementById('frequencycontainer').classList.remove('none')
    }
    updatecalories();
    adaptcalories(); //and add meals to menu!!
    for(let j = 0; j < dietaddarray.length; j++){
        dietadd(dietaddarray[j], false)
    }


}


function mobilecheck() {
    let check = false;
    (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
    ismobile = check;
}

function openbox(which, delay){
    var time = 1
    if(delay){time = delay}
    document.getElementById(which).classList.remove('withmoney')
    setTimeout(function (){
        document.getElementById(which).classList.remove('hiddenbox');
    },delay)
}
function closebox(which, delay){
    var time = 1
    if(delay){time = delay}
    setTimeout(function (){    document.getElementById(which).classList.add('hiddenbox');},time)
    setTimeout(function (){
        document.getElementById(which).classList.add('withmoney');
    },500+time)
}
function tabs(which){
    if (which === 4){ //withdraw
        opconfig(true)
        removeallbut(4, '')
        closebox('box1'); //selectcoinbox
        closebox('box2'); //selectcoinbox
        closebox('box3', 100); //selectcoinbox
        closebox('box4'); //selectcoinbox
    }
    else if (which === 3) { //history
        removeallbut(3, '')
        openbox('box2')
        closebox('box1'); //selectcoinbox
        closebox('box3'); //selectcoinbox
        closebox('box4'); //selectcoinbox
        opconfig(false) //config
    }
    else if(which === 2){ //market
        openbox('box1')
        openbox('box3',100)
        removeallbut(2, '')
        closebox('box2'); //transaction history box
        closebox('box4'); //selectcoinbox
        opconfig(false) //config
    }
    else if (which === 1) { //main
        removeallbut(1, '')
        closebox('box1'); //selectcoinbox
        closebox('box2'); //selectcoinbox
        closebox('box3', 100); //selectcoinbox
        closebox('box4'); //selectcoinbox
        opconfig(false) //config
    }
}

function removeallbut(thisone, phone){
    document.getElementById(phone+'button'+thisone).classList.add('tabselected')
    for(let i = 0; i < 3; i++){
        thisone++;
        if (thisone === 5){thisone = 1}
        document.getElementById(phone+'button'+thisone).classList.remove('tabselected');
    }
}

function ptabs(which) {
    if (which === 4) { //withdraw
        opconfig(true)
        removeallbut(4, 'p')
        closebox('box1'); //selectcoinbox
        closebox('box2'); //selectcoinbox
        closebox('box3', 100); //selectcoinbox
    } else if (which === 3) { //history
        removeallbut(3, 'p')
        closebox('box1'); //selectcoinbox
        closebox('box3'); //selectcoinbox
        opconfig(false) //config
    } else if (which === 2) { //market
        removeallbut(2, 'p')
        closebox('exchangebox1'); //selectcoinbox
        closebox('box2'); //transaction history box
        opconfig(false) //config
    } else if (which === 1) { //main
        removeallbut(1, 'p')
        closebox('box1'); //selectcoinbox
        closebox('box2'); //selectcoinbox
        closebox('box3', 100); //selectcoinbox
        opconfig(false) //config
    }
}



function opconfig(bool){
    if(bool){
        var box = document.getElementById('box5');
        box.classList.remove('none')
        setTimeout(function (){
            box.classList.remove('hiddencfg')
        },30)
    }
    else{
        var box = document.getElementById('box5');
        box.classList.add('hiddencfg')
        setTimeout(function (){
            box.classList.add('none')
        },500)
    }
}

let currentworkout = []
function starttraining(workout, wname, restore){
    if(!restore){
        Cookie("Current#Workout", "1>"+wname)
        currentworkout.push(["1>"+wname])
    }
    fadein('traintip',true)
    document.getElementById('routinesul').classList.add('none')
    document.getElementById('loaderp1').classList.remove('none')
    let ul = document.getElementById('workoutul');
    for(let i = 0; i < workout.length; i++){
        exerciselist.push(workout[i].name)
    }
    for(let i=0;i < workout.length; i++){
        let id = Id(workout[i].name)
        if(id.includes("(")){id = id.split("(")[0]}
        if(!exerciselist.includes(workout[i].name)){id = "Transparent"}
        let div = document.createElement("div");
        div.style.marginTop='2%'
        let setsorseconds = 'SETS';
        let onesetordone = 'REPS'
        let weightornone = 'KG'
        let sets = workout[i].sets
        let indextext = 'W'
        if (workout[i].type.includes('Seconds')){setsorseconds = 'SECONDS';; weightornone = ''; sets=workout[i].type.split("Seconds")[1]}
        else if (workout[i].type.includes('Check')){sets+=workout[i].warmup;onesetordone = '<i class="fa-solid fa-check"></i>'; weightornone = ''}

        div.innerHTML =           '<div style="display: flex; align-items: center;margin-top: 3%"> ' +
            '<div style="width: 75%; float: left;display: flex; align-items: center"> ' +
            '<img src="../img/exercises/'+id+'.jpg" style="width: 45px; float: left; margin-right: 6%"> ' +
            '<p onclick="openbox(\'box1\'); window.location=\'#'+id+'\'; selectvideo('+id+')" class="mediumtext workoutexercisename">'+workout[i].name+' ' +
            '</div> ' +
            '<div style="width: 25%; float: left"> ' +
            '<p class="mediumtext" style="float: left; text-align: right; width: 100%">'+sets+' '+setsorseconds +
            '</div> ' +
            '</div> '
        for (let j = 0; j < workout[i].warmup; j++){
            if(workout[i].type==="Check"){indextext = (j+1)}
            div.innerHTML += '<div style="display: inline-block; width: 100%"> '+
                '<div> ' +
                '<p class="mediumtext" style="width: 50%;float: left;font-weight: 400;line-height: 135%;margin-top: 2%; font-size: 58.5%; color: var(--appsmalltext); text-align: left">'+(indextext)+' - </p> ' +
                '<div style="width: 50%; float: left; text-align: right;position: relative"> ' +
                '<p class="mediumtext" style="float: left;font-weight: 400;line-height: 135%;margin-top: 2%; font-size: 58.5%; color: var(--appsmalltext); text-align: right; width: 68%"> </p>' +
                '<p id="'+i+'!'+j+'-Check" class="mediumtext" style="float: left;font-weight: 400;line-height: 145%;margin-top: 2%; font-size: 58.5%; color: var(--appsmalltext); ; width: 30%; background-color: var(--select); text-align: center; padding: 1%;padding-bottom: 0.5%;border-radius: 15px; cursor: pointer; transition: 0.5s" onclick="check(this);/*onkeyupworkoutvalue(\''+i+'!'+j+'-Check\')*/"><i class="fa-solid fa-check"></i></p>' +
                '</div> '+
                '</div> '
        }
        for (let j = 0; j < workout[i].sets; j++){
            div.innerHTML += '<div style="display: inline-block; width: 100%"> '+
                                    '<div> ' +
                                    '<p class="mediumtext" style="width: 50%;float: left;font-weight: 400;line-height: 135%;margin-top: 2%; font-size: 58.5%; color: var(--appsmalltext); text-align: left">'+(j+1)+' - </p> ' +
                                    '<div style="width: 50%; float: left; text-align: right;position: relative"> ' +
                                        '<input autocomplete="off" id="'+i+'!'+j+'-Set" onkeyup="onkeyupworkoutvalue(\''+i+'!'+j+'-Set\','+workout[i].sets+')" class="mediumtext" style="float: left;font-weight: 400;line-height: 135%;margin-top: 2%; font-size: 58.5%; color: var(--appsmalltext); text-align: right; width: 50%" placeholder="'+weightornone+'"> ' +
                                        '<input autocomplete="off" id="'+i+'!'+j+'-Reps" onkeyup="onkeyupworkoutvalue(\''+i+'!'+j+'-Reps\')" class="mediumtext" style="float: left;font-weight: 400;line-height: 135%;margin-top: 2%; font-size: 58.5%; color: var(--appsmalltext); text-align: right; width: 50%" placeholder="'+onesetordone+'"> ' +
                                    '</div> '+
                                '</div> '
        }
        div.innerHTML +=  '</div>'
        ul.appendChild(div)
    }
    let div = document.createElement("div");
    div.style.marginTop='18%'
    div.style.marginBottom='20%'
    div.innerHTML=
        '          <div id="doneb" style="font-size: 85%;transition: 0.5s;display: flex; align-items: center;margin-top: 3%; background: var(--apptext); padding: 2%;padding-right: 6%;padding-left: 6%;;border-radius: 15px">' +
        '            <div style="width: 74%; float: left;display: flex; align-items: center">' +
        '              <p id="donec" class="mediumtext" style="float: left; text-align: left; color: white; font-weight: 400; font-size: 70%">Finish Workout </p>' +
        '            </div>' +
        '            <div style=";width: 25%; float: left"><p id="donef" class="mediumtext" style="float: left;font-weight: 400;line-height: 135%;margin-top: 2%; font-size: 70%; color: white ; width: 100%; text-align: center;; padding: 1%;border-radius: 15px; cursor: pointer; transition: 0.5s" onclick="finishworkout();' +
        '            var a = document.getElementById(\'donef\');' +
        '            var b = document.getElementById(\'doneb\');' +
        '            b.style.backgroundColor = \'var(--green)\';' +
        '            a.style.transform = \'translateX(50%)\';' +
        '            a.onclick = function (){sendworkoutlog()};' +
        '            b.style.cursor = \'pointer\';' +
        '            document.getElementById(\'donec\').innerHTML=\'Send to Whatsapp\'">' +

        '<i class="fa-solid fa-check"></i></p>' +
        '            </div>' +
        '          </div>'+
        '<div style="margin-bottom: 30%;margin-top: 4%;cursor: pointer; text-align: center; font-size: 50%; font-weight: 600" class="smalltext" onclick="finishworkout();window.location.reload()">Cancel Workout <i class="fa-solid fa-xmark" style="font-size: 120%; transform: translateY(12%)"></i></div>'

    ul.appendChild(div)
    document.getElementById('excvideos').classList.add('none')
    setTimeout(function (){
        document.getElementById('loaderp1').classList.add('none')
        textpop('workoutphase','| TRAIN')
        document.getElementById('workoutfade').classList.remove('none')
        document.getElementById('workoutul').classList.remove('none')
    },300)
}

function Id(string){
    return string.replace(/\s/g, "")
}

var diettab = 1;
function diettabs(which){
    if(diettab !== which){
        diettab = which;
        document.getElementById('diettab'+which).classList.add('selected');
        document.getElementById('dietcat'+which).style.height = '45vh';
        document.getElementById('dietfade'+which).classList.remove('none');
        for(let i = 0; i < 2; i++){
            which++;
            if (which === 4){which = 1}
            document.getElementById('diettab'+which).classList.remove('selected');
            document.getElementById('dietcat'+which).style.height = '0';
            setTimeout(function (){    document.getElementById('dietfade'+which).classList.add('none');},1000)
        }
    }
    else{
        diettab = 0;
        document.getElementById('diettab'+which).classList.remove('selected');
        document.getElementById('dietcat'+which).style.height = '0';
        setTimeout(function (){    document.getElementById('dietfade'+which).classList.add('none');},1000)
    }
}

function textpop(id,text){
    var a = document.getElementById(id);
    a.classList.remove("textpop1")
    setTimeout(function (){
        if(text !== ""){a.innerHTML = text}
        a.classList.add("textpop1")
    },50)
}

function vidsearch(){
    let ul = document.getElementById('vidul');
    let list = ul.getElementsByTagName('div');
    let searchinput = document.getElementById('searchinput').value.toString().toUpperCase();

    for (let i = 0; i < list.length; i++) {
        let a = list[i].getElementsByTagName("p")[0].innerHTML.toString().toUpperCase();
        if (a.toUpperCase().indexOf(searchinput) > -1) {
            list[i].style.display = "inline-block";
        }
        else {
            list[i].style.display = "none";
        }
    }
}

function check(which){
    if(which.style.backgroundColor !== 'transparent'){
        which.style.backgroundColor = 'transparent';
        which.style.color = 'var(--green)';
        which.style.transform = 'translateX(35%)'
    }
    else{
        which.style.backgroundColor = 'var(--select)';
        which.style.color = 'var(--appsmalltext)';
        which.style.transform = 'translateX(0%)'
    }
}

function dietcheck(which){
    if(which.style.backgroundColor !== 'transparent'){
        if(which.id.includes('v')) {
            which.style.backgroundColor = 'transparent';
            which.style.color = 'var(--green)';
            which.style.transform = 'translateX(35%)'
            var a = document.getElementById(which.id.slice(0, -1)+"x")
            a.style.backgroundColor = 'transparent';
            a.style.color = 'transparent';
            a.style.transform = 'translateX(35%)'
            a.style.pointerEvents = 'none'
        }
        else{
            let number = which.id.split(">")[1].split("-")[0]
            which.style.backgroundColor = 'transparent';
            which.style.color = 'var(--red)';
            which.style.transform = 'translateX(130%)'
            var a = document.getElementById(which.id.slice(0, -1)+"v")
            a.style.backgroundColor = 'transparent';
            a.style.color = 'transparent';
            a.style.transform = 'translateX(35%)'
            a.style.pointerEvents = 'none'
            var meal = which.parentNode.parentNode.parentNode.parentNode
            addedmeals--;
            addedmealslist.splice((meal.id.split("_")[1].split("t")[0]-1), 1)
            meal.classList.remove("vanishd");
            meal.classList.add("vanish");
            Cookie("AddedMeals",countaddedmeals(), true)
            setTimeout(function (){meal.classList.add('none');
                meal.parentNode.removeChild(meal);
                usercalories -= parseInt(meal.children[1].children[0].children[0].innerHTML.split(" ")[0])
                updatecalories()
            },1000)
        }
    }
    else{
        which.style.backgroundColor = 'var(--select)';
        which.style.color = 'var(--appsmalltext)';
        which.style.transform = 'translateX(0%)'
        var a = document.getElementById(which.id.slice(0, -1)+"x")
        a.style.backgroundColor = 'var(--select)';
        a.style.color = 'var(--appsmalltext)';
        a.style.transform = 'translateX(0%)'
        a.style.pointerEvents = 'all'
    }
}

var addedmeals = 0;
var usercalories = 0;

function dietadd(which, newitem){

    let meal = meals[parseInt(which)]
    usercalories += parseInt(meal.calories.split(" ")[0]);
    let div = document.createElement("div");
    div.classList='addedmeal'
    if (newitem) div.classList='addedmeal vanishd'
    addedmeals++
    let ingredients = meal.ingredients.split('-')
    let recipe = '<p class="mediumtext" style=";width: 33%;float: left;font-weight: 400;line-height: 135%;margin-top: 1%; font-size: 58.5%; color: var(--appsmalltext); text-align: left">•'
    for(let i = 1; i < ingredients.length; i++){
        recipe += ingredients[i]
        if(i%2 !== 0 && i < ingredients.length-1){
            recipe += '<br>•'
        }
        else{
            recipe += '</p>'
            if(i < ingredients.length-1){
                recipe += '<p class="mediumtext" style=";width: 33%;float: left;font-weight: 400;line-height: 135%;margin-top: 1%; font-size: 58.5%; color: var(--appsmalltext); text-align: left">•'
            }
        }
    }
    div.id='addedmeal_'+addedmeals+"type"+which
    div.innerHTML = '          <div style="display: flex; align-items: center;margin-top: 3%">' +
        '            <div style="width: 75%; float: left;display: flex; align-items: center">' +
        '              <img src="../img/meals/'+meal.img+'.jpg" style="width: 45px; float: left; margin-right: 6%; border-radius: 100px">' +
        '              <p class="mediumtext" style="float: left; text-align: left; color: var(--apptext); font-weight: 600; font-size: 70%">'+meal.name+'</p></div> <div style="width: 25%; float: left">' +
        '            <p class="mediumtext" style="float: left; text-align: right; width: 97%">'+meal.timing+'</p>' +
        '          </div>' +
        '          </div>' +
        '          <div style="display: inline-block; width: 100%">' +
        '            <div style="width: 98%;margin-left: 2%">' +
        '              <p class="mediumtext" style="width: 70%;float: left;font-weight: 400;line-height: 135%;margin-top: 2%; font-size: 58.5%; color: var(--appsmalltext); text-align: left">'+meal.calories+'</p>' +
        '              <div style="width: 30%; float: left; text-align: right;position: relative">' +
        '                <p id="diet>'+addedmeals+'-x" class="mediumtext" style="margin-left: 14%;float: left;font-weight: 400;line-height: 155%;margin-top: 5%; font-size: 58.5%; color: var(--appsmalltext); ; width: 37.5%; background-color: var(--select); text-align: center; padding: 2.5%;padding-bottom: 1%;border-top-left-radius: 15px;border-bottom-left-radius: 15px; cursor: pointer; transition: 0.5s" onclick="dietcheck(this)"><i class="fa-solid fa-xmark"></i></p><p id="diet>'+addedmeals+'-v" class="mediumtext" style="float: left;font-weight: 400;line-height: 155%;margin-top: 5%; font-size: 58.5%; color: var(--appsmalltext); ; width: 37.5%; background-color: var(--select); text-align: center; padding: 2.5%;padding-bottom: 1%;border-bottom-right-radius: 15px;border-top-right-radius: 15px; cursor: pointer; transition: 0.5s" onclick="dietcheck(this)"><i class="fa-solid fa-check"></i></p>' +
        '              </div>' +recipe+
        '            </div>' +
        '          </div>'
    document.getElementById('addmealul').appendChild(div);
    tabs(1)
    if(newitem){
        setTimeout(function (){dietcheck(document.getElementById('diet>'+addedmeals+'-v'))},750)
        addedmealslist.push(which)
        Cookie("AddedMeals",countaddedmeals(), true);
        updatecalories()
    }
    else dietcheck(document.getElementById('diet>'+addedmeals+'-v'))
}
function mealsadd(){
    let i = 0;
    let mealtype;
    for (let j = 0; j < meals.length; j++){
        let div = document.createElement("div");
        div.classList="dietmeals"
        let name = meals[j].name;
        if(name.includes("!")){
            meals.splice(j,1);
            i++; mealtype = name.split("!")[1]; name=meals[j].name;
        }
        let tag = ''
        if(meals[j].tag === 'PRE'){
            tag = ' <span style="font-size: 65%; background-color: #FF5500; color: white; border-radius: 50px; padding: 0 4px 0 3px; display: inline-block; transform: translateY(-10%)"> PRE <i class="fa-solid fa-dumbbell"></i></span>'
        }
        else         if(meals[j].tag === 'POST'){
            tag = ' <span style="font-size: 65%; background-color: #00AA01; color: white; border-radius: 50px; padding: 0 4px 0 3px; display: inline-block; transform: translateY(-10%)"> POST <i class="fa-solid fa-heart"></i></span>'
        }
        else         if(meals[j].tag === 'BED'){
            tag = ' <span style="font-size: 65%; background-color: #1249b6; color: white; border-radius: 50px; padding: 0 4px 0 3px; display: inline-block; transform: translateY(-10%)"> BED <i class="fa-solid fa-bed"></i></span>'
        }
        div.onclick = function (){dietadd(j, true)}
        let ingredients;
        if(meals[j].ingredients.split("-").length === 2){ingredients = "•"+meals[j].ingredients.split("-")[1].slice(0,13)}
        else{ingredients = "•"+meals[j].ingredients.split("-")[1].slice(0,13)+'<br>•'+meals[j].ingredients.split("-")[2].slice(0,13)+"..."}
        div.innerHTML = '                <div style="display: flex; align-items: center;margin-top: 3%; position: relative">' +
            '                  <div style="width:80%; float: left;display: flex; align-items: center;">' +
            '                    <img src="../img/meals/'+/*name.replace(/\s/g, "")*/meals[j].img+'.jpg" style="width: 45px; float: left; border-radius: 100px; margin-right: 6%">' +
            '                    <p class="mediumtext" style="; text-align: left; color: var(--apptext); font-weight: 600; font-size: 70%">'+name.slice(0,16)+tag+'<br>' +
            '                      <span class="mediumtext" style=";font-weight: 400;line-height: 135%;margin-top: 2%; font-size: 80%; color: var(--appsmalltext); text-align: left">'+meals[j].calories+'</span>' +
            '                    </p>' +
            '                  </div>' +
            '                  <div style="width: 35%; float: left">' +
            '                    <p class="mediumtext" style="position: relative;;width: 100%;float: right;font-weight: 400;; font-size: 58.5%; color: var(--appsmalltext); text-align: right; line-height: 150%">'+ingredients+'</p>' +
            '' +
            '                  </div>' +
            '                </div>'
        let ul = document.getElementById("mealtype"+i)
        ul.appendChild(div);
    }
    tabs(1)
}

function Cookie(cname, cvalue, oneday){
    var d = new Date();
    if(oneday){
        d.setHours(23,59,59,0);
    }
    else{
        let exdays = "365";
        d.setTime(d.getTime() + (exdays*24*60*60*1000));
    }
    var expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function countaddedmeals(){
    var result= ''
    for(let i = 0; i < addedmealslist.length; i++){
        result +=addedmealslist[i]
        if(i < addedmealslist.length-1){result+=","}
    }
    return result
}

function uploadweight(){
    var d = new Date();
    userweight.push(    {
        "weight": kginput.value,
        "date": d.toUTCString().slice(5, 16)
    })
    kginput.type = "text"
    kginput.value = "Done!"
    kginput.readOnly = true
    setTimeout(function (){
        kginput.readOnly = false
        kginput.type = "number"
        kginput.value = "00.00"
    },1500)
    document.getElementById('chartcontainer').innerHTML = '<canvas id="myChart"></canvas>';
    setTimeout(function (){chart(true)},100)
}
var kginput = document.getElementById('kginput')
kginput.addEventListener('keyup', debounce( () => {
    doneTyping()
}, 300))

var oldvalue = 0;

function doneTyping(){
    if (kginput.value === ''){kginput.value = 0}
    if(kginput.value[kginput.value.length-1] === '0' && kginput.value.includes('.')){
        kginput.value = (parseFloat(kginput.value)*10).toFixed(2)
    }
    else{
        if(parseFloat(kginput.value).countDecimals() <= 1 ){
            kginput.value = (kginput.value * 0.01).toFixed(2)
        }
        else{while(parseFloat(kginput.value).countDecimals() > 2 ){
            kginput.value =(kginput.value * Math.pow(10, parseFloat(kginput.value).countDecimals()-2)).toFixed(2)
        }}
    }
}

function weightinputclick(){
    if (parseFloat(kginput.value) === 0){
        kginput.value = 0
    }
}

function debounce(callback, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(function () { callback.apply(this, args); }, wait);
    };
}

Number.prototype.countDecimals = function () {
    if(Math.floor(this.valueOf()) === this.valueOf()) return 0;
    return this.toString().split(".")[1].length || 0;
}

function fadein(id, bool){
    if(bool){
        var a = document.getElementById(id)
        a.classList.remove('none')
        a.classList.add('vanishd2')
    }
    else{
        a.classList.add('vanish2')
        setTimeout(function (){a.classList.add('none')},800)
    }
}

function onkeyupworkoutvalue(id, sets){
    /*if(!id.includes("Check")){*/
    var set = document.getElementById(id.split("-")[0]+"-Set")
    var rep = document.getElementById(id.split("-")[0]+"-Reps")
    if(sets && id.includes('Set') && set.value !== ''){
        for(let k = parseInt(id.split("!")[1].split('-')[0]); k < sets; k++){
            let newid = id.split("!")[0]+"!"+k+"-Set"
            setTimeout(function (){
                if(document.getElementById(newid).value === ''){
                    document.getElementById(newid).value = document.getElementById(id).value
                }
            },1000)

        }
    }
    if (set.value !== '' && rep.value !== ''){
        workoutvalues(id, set, rep)
    }
    /*}
    else{
        var i = id.split("!")[0]
        var j = id.split("!")[1].split("-")[0]
        var type = id.split("-")[1]
        currentworkout.push([i,j,value])
        Cookie("CurrentWorkout"+i+"!"+j,'*Check')
        document.getElementById(id).onclick = function (){
            check(this); onkeyupworkoutvalue(+i+'!'+j+'-UnCheck');
        }
    }*/

}

function workoutvalues(id, set, rep){
    let bool = -1;
    for(let i = 1; i < currentworkout.length; i++){
        if (id.includes(currentworkout[i][0].toString()+"!"+currentworkout[i][1].toString())){
            bool = i;
        }
    }
    let value = set.value+"&"+rep.value
    var i = id.split("!")[0]
    var j = id.split("!")[1].split("-")[0]
    if(bool === -1) {
        var type = id.split("-")[1]
        currentworkout.push([i,j,value])
        Cookie("CurrentWorkout"+i+"!"+j,value)
    }
    else{
        currentworkout[bool][2] = value
        Cookie("CurrentWorkout"+i+"!"+j,value)
    }
}

function workoutupdate(){
    let id1=workoutlist().findIndex(x => x.frequency === workoutfrequency )
    let wklist = workoutlist()[id1].workout[workoutlist()[id1].workout.findIndex(z => z.varname === currentworkout[0][0].split('>')[1])]
    starttraining(wklist.id, currentworkout[0], true)
    for(let i = 1; i < currentworkout.length; i++){
        document.getElementById(currentworkout[i][0]+"!"+currentworkout[i][1]+"-Set").value = currentworkout[i][2].split("&")[0]
        document.getElementById(currentworkout[i][0]+"!"+currentworkout[i][1]+"-Reps").value = currentworkout[i][2].split("&")[1]
    }

}

function weeksdropdown(bool){
    if(bool) {
        document.getElementById('drop').style.display = 'block'
        setTimeout(function (){document.getElementById('drop').classList.add("droppeddown")},10)
    }
    else{
        document.getElementById('drop').classList.remove("droppeddown")
        setTimeout(function (){document.getElementById('drop').style.display = 'none'},500)
    }
}

function frequencydropdown(bool){
    if(bool) {
        document.getElementById('fdrop').style.display = 'block'
        setTimeout(function (){document.getElementById('fdrop').classList.add("droppeddown")},10)
    }
    else{
        document.getElementById('fdrop').classList.remove("droppeddown")
        setTimeout(function (){document.getElementById('fdrop').style.display = 'none'},500)
    }
}

function weekselect(which){
    document.getElementById('weekdrop').innerHTML = which.innerHTML+' <i class="fa-solid fa-angle-down" style="margin-left: 5%; transform: translateY(10%)"></i>'
    weeksdropdown(false)
    Cookie("CurrentWeek", which.innerHTML.split(' ')[1])
}

function frequencyselect(which){
    document.getElementById('chosenfrequency').innerHTML = which.innerHTML
    frequencydropdown(false)
}

var thisuserstats;
function updateuseridstuff(id){
    if(userstats.find(o => o.userid === id)){
        let i = userstats.findIndex(x => x.userid === id)
        thisuserstats = userstats[i];
        document.getElementById('cal1').innerHTML = userstats[i].targetCalories
        document.getElementById('cal2').innerHTML = userstats[i].targetCalories
        document.getElementById('desc1').innerHTML = userstats[i].caloriesDescription
        document.getElementById('desc2').innerHTML = userstats[i].comingNext
        document.getElementById('username').value = userstats[i].userid
    }
}

//document.getElementById('username').addEventListener('keyup', debounce( () => {
function userIdapp(){
    let inp = document.getElementById('username')
    Cookie('userId',inp.value);

    if(workoutlist().find(o => o.frequency === inp.value)){
        Cookie('CurrentFrequency', inp.value);
    }
    window.location.reload()
}

//}, 300))

function exportcookies(){
    var cookieData = document.cookie.split(';').map(function(c) {
        var i = c.indexOf('=');
        return [c.substring(0, i), c.substring(i + 1)];
    });
    let copyText = document.getElementById("export");
    copyText.value = (JSON.stringify(JSON.stringify(cookieData)))
    let hold = copyText.value
    setTimeout(function (){
        copyText.select();
        copyText.setSelectionRange(0, 99999);
        navigator.clipboard.writeText(copyText.value);
        copyText.value = 'Copied!';
        setTimeout(function (){copyText.value=hold}, 1000)
    },10)
}

function importcookies(){
    let input = document.getElementById('backupcode')
    if(input.value !== '') {
        document.cookie.split(";").forEach(function(c) { document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); });
        var cookieData = JSON.parse(JSON.parse(input.value));
        cookieData.forEach(function (arr) {
            if(arr[0] !== "AddedMeals" && arr[0] !== "CurrentWorkout" && arr[0] !== "Current#Workout=1")
            Cookie(arr[0],arr[1])
        });
        let hold = input.value
        input.value = 'Imported!';
        setTimeout(function (){input.value=hold}, 1000)
    }
    else{
        let hold = input.value
        input.value = 'Paste the value here!';
        setTimeout(function (){input.value=hold}, 1000)
    }
}

function finishworkout(){
    /*Cookie("Current#Workout", 0)
    for(let i = 1; i < currentworkout.length; i++){
        Cookie('CurrentWorkout'+currentworkout[i][0]+"!"+currentworkout[i][1], '?')
    }*/
    var cookieNames = document.cookie.split(/=[^;]*(?:;\s*|$)/);
    for (var i = 0; i < cookieNames.length; i++) {
        if (cookieNames[i].toString().includes('Workout')) {
            document.cookie = cookieNames[i] + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
        }
    }
}

let workoutfrequency = 3;
function loadworkouts(freq){
    workoutfrequency = freq;
    if (freq !== "3" || freq !== "4" || freq !== "5" || freq !== "6"){
        document.getElementById('frequencypicker').classList.add("none")
    }
    let ul = document.getElementById('routinesul')
    let h = workoutlist().findIndex(x => x.frequency === freq)

    for(let i = 0; i < workoutlist()[h].workout.length; i++){
        let selectedworkout = workoutlist()[h].workout[i].id
        let div = document.createElement("div");
        div.classList = 'workouts'
        div.onclick = function (){starttraining(selectedworkout, workoutlist()[h].workout[i].varname)}
        let exercisesamount, setsamount = 0;
        exercisesamount = selectedworkout.length
        for (let j = 0; j < selectedworkout.length; j++){
            if(selectedworkout[j].name === 'Warm Up') exercisesamount--
            setsamount += parseInt(selectedworkout[j].sets)
        }
        div.innerHTML = '          <div style="display: flex; align-items: center;margin-top: 3%">' +
            '            <div style="width: 65%; float: left;display: flex; align-items: center">' +
            '              <p class="mediumtext" style="float: left; text-align: left; color: var(--apptext); font-weight: 600; font-size: 70%">'+workoutlist()[h].workout[i].name+' </p>' +
            '            </div>' +
            '            <div style="width: 35%; float: left"> <p class="mediumtext" style="float: left; text-align: right; width: 100%">'+workoutlist()[h].workout[i].duration+'</p>' +
            '          </div>' +
            '          </div>' +
            '          <div style="display: inline-block; width: 100%"> <div> <p class="mediumtext" style="width: 50%;float: left;font-weight: 400;line-height: 135%;margin-top: 2%; font-size: 58.5%; color: var(--appsmalltext); text-align: left">'+exercisesamount+' EXERCISES' +
            '          </p>' +
            '            <div style="width: 50%; float: left; text-align: right;position: relative">' +
            '              <p class="mediumtext" style="float: left;font-weight: 400;line-height: 135%;margin-top: 2%; font-size: 58.5%; color: var(--appsmalltext); text-align: right; width: 50%">' +
            '' +
            '              </p>' +
            '              <p class="mediumtext" style="float: left;font-weight: 400;line-height: 135%;margin-top: 2%; font-size: 58.5%; color: var(--appsmalltext); text-align: right; width: 50%">'+setsamount+' SETS</p> </div> </div> </div></div>'
        ul.appendChild(div)
    }
    let dv = document.createElement('p')
    dv.classList = 'mediumtext routinesequence'
    dv.innerHTML = workoutlist()[h].sequence
    ul.appendChild(dv)
    document.getElementById('loaderp1').classList.add('none')
    document.getElementById('routinesul').classList.remove('none')
}


function pickfrequency(){
    document.cookie.split(";").forEach(function(c) {if(c.includes("CurrentFrequency")){document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); }});
    window.location.reload()
}

function updatecalories(){
    document.getElementById("remaining").innerHTML = -parseInt(usercalories)+parseInt(thisuserstats.targetCalories);
}
function adaptcalories(){
    for(let i = 0; i < meals.length; i++){
        if(meals[i].firstingredientcalories){
            let ingredientamount = parseInt(meals[i].ingredients.split(" ")[1].replace(/\D/g,''))
            let mealcalories = parseInt(meals[i].calories.split(" ")[0])
            let newmealcalories = (mealcalories*thisuserstats.targetCalories)/3041
            let newingredientamount
            if(meals[i].secondingredientcalories){
                if(meals[i].ingredients.split("- ")[2].split(" ")[0].includes("g")){
                    newingredientamount = (((ingredientamount*meals[i].firstingredientcalories)+((newmealcalories-mealcalories)/3)*2))/meals[i].firstingredientcalories
                    let ingredientamount2 = parseInt(meals[i].ingredients.split("- ")[2].split(" ")[0].replace(/\D/g,''))
                    let newingredientamount2 = (((ingredientamount2*meals[i].secondingredientcalories)+((newmealcalories-mealcalories)/3)*1))/meals[i].secondingredientcalories
                    meals[i].ingredients = "- "+round(newingredientamount,5)+meals[i].ingredients.split(ingredientamount)[1].split("- ")[0]+ "- "+round(newingredientamount2,5)+meals[i].ingredients.split(ingredientamount2)[1]
                }
                else{
                    let ingredientamount2 = parseInt(meals[i].ingredients.split("- ")[2].split(" ")[0].replace(/\D/g,''))
                    let extracals = (newmealcalories-mealcalories)/2
                    let units = 0;
                    if(Math.abs(extracals) >= meals[i].secondingredientcalories){
                        if(extracals > 0){
                            while(extracals >= meals[i].secondingredientcalories){
                                units++;
                                extracals = extracals-meals[i].secondingredientcalories
                            }
                        }
                        else if(extracals < 0){
                            while(Math.abs(extracals) >= meals[i].secondingredientcalories){
                                units--;
                                extracals = extracals+meals[i].secondingredientcalories
                            }
                        }
                    }
                    let newingredientamount2 = ingredientamount2 + units
                    newingredientamount = ingredientamount + extracals/meals[i].firstingredientcalories
                    meals[i].ingredients = "- "+round(newingredientamount,5)+meals[i].ingredients.split(ingredientamount)[1].split("- ")[0]+ "- "+newingredientamount2+meals[i].ingredients.split(ingredientamount2)[1]

                }
            }
            else{
                newingredientamount = (((ingredientamount*meals[i].firstingredientcalories)+(newmealcalories-mealcalories)))/meals[i].firstingredientcalories
                meals[i].ingredients = "- "+round(newingredientamount,5)+meals[i].ingredients.split(ingredientamount)[1]
            }
            meals[i].calories = round(newmealcalories,5)+meals[i].calories.split(mealcalories)[1]
        }
    }
    mealsadd()
}

function round(num,multipleOf) {
    return Math.floor((num + multipleOf/2) / multipleOf) * multipleOf;
}


function generategroceries(){
    let loader = document.getElementById('loaderp2')
    loader.classList.remove('none')
    document.getElementById('loadedp2').classList.add('none')
    let list = document.getElementById('grocerieslist')
    list.classList.remove('vanishdq')
    list.classList.remove('Failed')
    let grocerieslist = []
    for(let i = 0; i < addedmeals; i++){
        for(let j = 1; j < (meals[addedmealslist[i]].ingredients.split('- ').length); j++){
            grocerieslist.push({
                "ingredient": meals[addedmealslist[i]].ingredients.split('- ')[j].split(meals[addedmealslist[i]].ingredients.split('- ')[j].split(" ")[0])[1],
                "quantity": meals[addedmealslist[i]].ingredients.split('- ')[j].split(" ")[0],
            })
            if(grocerieslist[grocerieslist.length-1].quantity.toString().includes("g")){
                grocerieslist[grocerieslist.length-1].quantity = parseInt(grocerieslist[grocerieslist.length-1].quantity.replace(/\D/g,''))*7
                grocerieslist[grocerieslist.length-1].quantity += 'g';
            }
            else if(grocerieslist[grocerieslist.length-1].quantity.toString().includes("ptional")){
                grocerieslist[grocerieslist.length-1].quantity = ""
            }
            else{
                grocerieslist[grocerieslist.length-1].quantity = parseInt(grocerieslist[grocerieslist.length-1].quantity)*7+"x"
            }
            if(grocerieslist[grocerieslist.length-1].ingredient[grocerieslist[grocerieslist.length-1].ingredient.length-1] === " "){
                grocerieslist[grocerieslist.length-1].ingredient = grocerieslist[grocerieslist.length-1].ingredient.slice(0, -1)
            }
            if(grocerieslist[grocerieslist.length-1].ingredient[0] === " "){
                grocerieslist[grocerieslist.length-1].ingredient = grocerieslist[grocerieslist.length-1].ingredient.slice(1)
            }

        }
    }
    let groceriestext = 'Your Groceries List for a Week:<br><br style="display: block; content: \'\';margin-top: 5px">'
    let extralist = []
    if(grocerieslist.length === 0){
        groceriestext = "Add Meals on the Diet tab to generate your Groceries."
        list.classList.add('Failed')
    }
    for(let i = 0; i < grocerieslist.length; i++){
        for(let j = 0; j < grocerieslist.length; j++){
            if(grocerieslist[i].ingredient === grocerieslist[j].ingredient && i !== j){
                if(grocerieslist[i].quantity.includes('g')){grocerieslist[i].quantity = parseInt(grocerieslist[i].quantity)+parseInt(grocerieslist[j].quantity)+'g'
                    if(grocerieslist[grocerieslist.length-1].quantity > 999){
                        console.log(grocerieslist[grocerieslist.length-1].ingredient)
                        console.log(grocerieslist[grocerieslist.length-1].quantity)
                        console.log(parseFloat(grocerieslist[grocerieslist.length-1].quantity))
                        grocerieslist[grocerieslist.length-1].quantity = parseFloat(grocerieslist[grocerieslist.length-1].quantity)/1000+"Kg"
                        console.log(grocerieslist[grocerieslist.length-1].quantity)
                    }
                }
                else{grocerieslist[i].quantity = parseInt(grocerieslist[i].quantity)+parseInt(grocerieslist[j].quantity)+'x'}
                grocerieslist.splice(j,1)
            }

        }
    }

    for(let i = 0; i < grocerieslist.length; i++) {
        if(parseInt(grocerieslist[i].quantity) > 999){
            console.log(grocerieslist[i].ingredient)
            console.log(grocerieslist[i].quantity)
            console.log(parseFloat(grocerieslist[i].quantity))
            grocerieslist[i].quantity = parseFloat(grocerieslist[i].quantity)/1000+"Kg"
            console.log(grocerieslist[i].quantity)
        }
        if(grocerieslist[i].quantity === ''){
            extralist.push(grocerieslist[i])
            grocerieslist.splice(i,1)
        }
        else{
            groceriestext += '<i class="fa-regular fa-circle-check" style="transition: 0.2s;font-size: 120%; display: inline-block; margin-right: 2%;cursor: pointer; transform: translateY(4%);" onclick="circlecheck(this)"></i><b style="user-select: none">'+grocerieslist[i].quantity+"</b> "+grocerieslist[i].ingredient+"<br>"
        }
    }

        for(let i = 0; i < extralist.length; i++){
        groceriestext += '<b style="user-select: none; font-size: 70%; font-weight: 700; transform: translateY(-5%); display: inline-block; margin-right: 2%">OPTIONAL</b>'+extralist[i].ingredient+'<br>'
    }
    setTimeout(function (){
        loader.classList.add('none')
        document.getElementById('loaded2p2').classList.remove("none")
        list.innerHTML = groceriestext
        list.classList.add('vanishdq')
    },300)
}

function circlecheck(which){
    if (which.className === "fa-regular fa-circle-check"){
        which.className = "fa-solid fa-circle-check"
    }
    else{
        which.className = "fa-regular fa-circle-check"
    }
}

var stored = ''
function selectvideo(which){
    stored = which
    if (which.className.includes("selectedvideo")){

    }
    else{
        which.classList.add("selectedvideo")
    }
}

function sendworkoutlog(){
    console.log(currentworkout)
    let id1=workoutlist().findIndex(x => x.frequency === workoutfrequency )
    let wklist = workoutlist()[id1].workout[workoutlist()[id1].workout.findIndex(z => z.varname === currentworkout[0][0].split('>')[1])]
    console.log(wklist)
    let bigtxt = ''
    let holder = ''
    for(let i = 1; i < currentworkout.length; i++){
        let wkexercise = wklist.id[parseInt(currentworkout[i][0])]
        if(wkexercise !== holder){
            bigtxt += "%0a"+wkexercise.name+": %0a"
            holder = wkexercise
        }
        bigtxt += (parseInt(currentworkout[i][1])+1)+" - "+currentworkout[i][2].split('&')[0]+" KG for "+currentworkout[i][2].split('&')[1]+" Reps%0a"
    }
    console.log(bigtxt)
    window.open('https://api.whatsapp.com/send/?phone=5519988760900&text='+bigtxt)
    //window.location.reload()
}
