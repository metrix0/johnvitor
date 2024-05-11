var auth = false
function CookieGet(){
    let cookies = document.cookie.split(';')
    for(let i = 0; i<cookies.length; i++){
        if(cookies[i].includes("AMNTKEY=")){
            auth = true
        }
    }
    if(location.toString().includes('register')){openlogin(true)}
}

function login(){
    if(!auth) {
        let user = document.getElementById('userholder')
        let email = document.getElementById('emailholder')
        let pwd = document.getElementById('pwdholder')

        if (user.value.match(/\d+/g) !== null || user.value === ""){
            let back = user.value
            user.value = "Correct your name!"
            let cont = document.getElementById('usercontainer')
            cont.classList.add('erroranimation')
            let pass = true
            cont.onclick = function (){user.value = back; pass = false}
            setTimeout(function (){cont.classList.remove('erroranimation'); setTimeout(function (){if(pass)user.value = back},1000)},810)
        }
        else if (!email.value.includes("@") || !email.value.includes(".") || email.value === ""){
            let back = email.value
            email.value = "Correct your e-mail!"
            let cont = document.getElementById('emailcontainer')
            cont.classList.add('erroranimation')
            let pass = true
            cont.onclick = function (){email.value = back; pass = false}
            setTimeout(function (){cont.classList.remove('erroranimation'); setTimeout(function (){if(pass)email.value = back},1000)},810)
        }
        else if (pwd.value === "" || pwd.value.length < 7){
            pwd.type = 'text'
            pwd.value = "At least 8 numbers/letters long!"
            let cont = document.getElementById('pwdcontainer')
            cont.classList.add('erroranimation')
            let pass = true
            cont.onclick = function (){pwd.value = ''; pass = false; pwd.type = 'password'}
            setTimeout(function (){cont.classList.remove('erroranimation'); setTimeout(function (){if(pass){pwd.type = 'password'; pwd.value = ''}},1000)},810)
        }
        else{
            let date = new Date(Date.now())
            let value = "pwd:"+pwd.value+"username:"+ user.value + "useremail:"+email.value+"verifiedat:"+date
            Cookie("AMNTLOGINUSER",value)
            setTimeout(function (){window.location.href='login/#verify'},300)
        }
    }
    else{
        window.location.href='dashboard'
    }
}

function Cookie(cname, cvalue){
    let exdays = "365";
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function openlogin(bool, which){
    if(bool || (which === '2' && bool)){
        if(!auth || which === '2') {
            let black = document.getElementById('black')
            let shift = document.getElementById('shift'+which)
            black.classList.remove('withmoney');
            setTimeout(function (){black.style.opacity = 0.8},30)
            shift.classList.remove('withmoney');
            setTimeout(function (){shift.classList.remove('hiddencfg')},30)
        }
        else{
            window.location.href='dashboard'
        }
    }
    else{
        let black = document.getElementById('black')
        let shift = document.getElementById('shift'+which)
        black.style.transition = '0.4s'
        black.style.opacity = 0
        setTimeout(function (){        black.classList.add('withmoney');        black.style.transition = '0.8s'
        },800)
        shift.classList.add('hiddencfg')
        setTimeout(function (){        shift.classList.add('withmoney');},500)
    }
}
let coinlist = ['btc','eth','usdt','usdc','bnb','sol','ada','avax','doge','trx','matic','ltc','dot','shib','dai','ton','link','xlm','leo','uni','tusd','atom','xmr','okb','fil','hbar','mnt','dao','apt','arb','cro','vet','near','mkr','qnt','op','grt','aave','algo','sand','axs','stx','egld','imx','eos','xtz','theta','usdd','bsv','mana','snx','inj','ftm','ape','neo','flow','kava','crv','xec','kcs','usdp','gala','klay','paxg','xaut','zec','miota','cspr','fxs','comp','ht','tktk','sui','mina','bone','nexo','gusd','dash','ar','dydx','zil','cake','nft','rune','1inch','woo','flr','hnt','gno','mask','enj','lrc','btg','rose','kntr','xem','qtum','tfuel','cvx','ens','wld','celo','agix','xch','ankr','rvn','osmo','dcr','bal','astr','hot','sc','jst','sfp','glm','t','wave','floki','ocean','yfi','icx','kor','fpi','xht','dg','bzrx','clt','xsr','kbc','kndc','msr','dmt','mof','chat','xin','neu','cmt','payx','xuc','cob','xpa','poe','plbt','wgr','edg','swt','krb','sls','sib','crw','emc','start','bela','stak','ode','nu','brd','npxs','tkn','adk','poopcoin','iov','xcm','ryo','pbtc','seele','block','wings','omni','any','mns','exp','pma','sub','merge','pink','blk','sky','trtl','wpr','bitb','egt','tera','lumd','clam','tor','appc','dgd','vibe','lun','asafe']
let namelist = ['Bitcoin','Ethereum','USD Tether','USD Coin','BNB','Solana','Cardano','Avalanche','Dogecoin','Tron','Polygon','Litecoin','Polkadot','Shiba Inu','Dai','Toncoin','Chainlink','Stellar','Leo','Uniswap','TrueUSD','Cosmo','Monero','OKB','Filecoin','Hedera','Mantle','Dao','Aptos','Arbitrum','Cronos','VET','NEAR','Maker','Quant','Optimism', 'Graph Token', 'Aave', 'Algorand', 'The Sandbox', 'Axie Infinity', 'Stacks', 'Elrond', 'Immutable X', 'EOS', 'Tezos', 'Theta Network', 'USD Digital', 'Bitcoin SV', 'Decentraland', 'Synthetix', 'Injective Protocol', 'Fantom', 'ApeCoin', 'Neo', 'Flow', 'Kava', 'Curve DAO Token', 'eCash', 'KuCoin Token', 'USDP Stablecoin', 'Gala', 'Klaytn', 'PAX Gold', 'Tether Gold', 'Zcash', 'IOTA', 'Casper', 'Frax Share', 'Compound', 'Huobi Token','Tank Tank','Sui', 'Mirrored Ishares', 'Bone', 'Nexo', 'Gemini Dollar', 'Dash', 'Arweave', 'dYdX', 'Zilliqa', 'PancakeSwap', 'NFT Protocol', 'Rune', '1inch Exchange', 'Wootrade Network', 'Flare', 'Helium', 'Gnosis', 'Mask Network', 'Enjin Coin', 'Loopring', 'Bitcoin Gold', 'Oasis Network','Kentron', 'NEM', 'Qtum', 'Theta Fuel', 'Convex Finance', 'ENS', 'Wild Crypto', 'Celo', 'SingularityNET', 'Chia', 'Ankr', 'Ravencoin', 'OSMO', 'Decred', 'Balancer', 'Astar', 'Holo', 'Siacoin', 'JUST', 'SafePal', 'Golem', 'Threshold', 'Wave Financial', 'Floki Inu', 'Ocean Protocol', 'Yearn.finance', 'ICON','KLOA','Frax Price Index', 'HollaEx', 'DeGate', 'bZx', 'CoinLoan', 'Xensor', 'KBC', 'KNDC', 'Masari', 'DMarket', 'Molecular', 'ChatCoin', 'Mixin', 'Neumark', 'CyberMiles', 'PayX', 'Exchange Union Coin', 'Cobinhood', 'XPA', 'Po.et', 'Polybius', 'Wagerr', 'Edgeless', 'Swarm City', 'Karbo', 'SaluS', 'SIBCoin', 'Crown', 'Emercoin', 'Startcoin', 'Bela', 'STRAKS', 'ODEM', 'NuCypher', 'Bread', 'Pundi X', 'TOKPIE', 'Aidos Kuneen', 'PoopCoin', 'IOV', 'CoinMetro', 'Ryo Currency', 'pBTC', 'Seele', 'Blocknet', 'Wings DAO', 'Omni', 'Anyswap', 'Miners', 'Expanse', 'PumaPay', 'Substratum', 'MergeCoin', 'Pinkcoin', 'BlackCoin', 'Skycoin', 'TurtleCoin', 'WePower', 'Bean Cash', 'Egretia', 'TERA','Luminade','Clams', 'Torcoin', 'AppCoins', 'DigixDAO', 'VIBEHub', 'Lunyr', 'AllSafe']

portfolio()

function portfolio(){
    let j = 0;
    for (let k = 1; k < 4; k++){
        let place = document.getElementById("mul"+k)
        for (let i = 0; i<10; i++){
            let div = document.createElement("div");
            div.style.animationDelay=(i*3).toString()+"s";
            div.style.whiteSpace='nowrap';
            div.className ="introanimation introcell"
            div.innerHTML= '        <img src="img/'+coinlist[j]+'.svg" style="float: left; height: 100%; margin-right: 6%"><p style="line-height: 30px">'+namelist[j]+'</p>\n'
            place.appendChild(div);
            j++
        }
    }
}