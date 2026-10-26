const $ = id => document.getElementById(id);
let worker, busy=false, imageURL, request=0;
const status = (text,error=false) => {
  $('status-text').textContent=text;
  $('status').classList.toggle('error',error);
};
function setBusy(value) {
  busy=value;
  $('photo-card').classList.toggle('processing',value);
  $('sample-button').disabled=value;
  $('file-input').disabled=value;
  $('drop-zone').setAttribute('aria-disabled',String(value));
}
function getWorker() {
  if(worker) return worker;
  worker=new Worker(new URL('./worker.js?v=2',import.meta.url));
  return worker;
}
async function analyze(file,name) {
  if(busy) return;
  if(file.size>10*1024*1024) return status('A foto precisa ter até 10 MB. Escolha uma imagem menor.',true);
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)) return status('Escolha uma imagem JPG, PNG ou WEBP.',true);
  setBusy(true);
  $('result-view').hidden=true; $('upload-view').hidden=false;
  status('Preparando o modelo… Na primeira vez, o carregamento pode levar até um minuto.');
  try {
    const bitmap = await createImageBitmap(file);
    if(bitmap.width*bitmap.height>40000000) {bitmap.close();throw Error('Imagem muito grande. Use uma foto com até 40 megapixels.');}
    bitmap.close();
    if(imageURL) URL.revokeObjectURL(imageURL);
    imageURL=URL.createObjectURL(file);
    $('dish-photo').src=imageURL;
    $('dish-photo').alt=name;
    $('photo-kicker').textContent='UM NOVO OLHAR SOBRE A SUA FOTO';
    $('photo-name').textContent=name==='Massa ao pesto'?'Massa ao pesto':'Seu prato, em foco.';
    const bytes=await file.arrayBuffer();
    const current=++request;
    const engine=getWorker();
    const price=await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{engine.terminate();worker=null;reject(Error('O carregamento demorou mais que o esperado. Confira a conexão e tente novamente.'));},180000);
      engine.onmessage=({data})=>{
        if(data.id!==current) return;
        clearTimeout(timeout);
        if(data.error) reject(Error(data.error)); else resolve(data.price);
      };
      engine.onerror=()=>{clearTimeout(timeout);engine.terminate();worker=null;reject(Error('Não foi possível carregar o modelo. Confira a conexão e tente novamente.'));};
      engine.postMessage({id:current,bytes},[bytes]);
    });
    $('price').textContent=price.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
    $('upload-view').hidden=true;$('result-view').hidden=false;
    status('Análise concluída. Sua foto não saiu deste dispositivo.');
  } catch(error) {status(error.message || 'Não conseguimos ler a imagem. Tente outra foto.',true);}
  finally {setBusy(false);}
}
$('file-input').addEventListener('change', e=>{
  const file=e.target.files[0];if(file) analyze(file,'Sua foto');
  e.target.value='';
});
const drop=$('drop-zone');
drop.tabIndex=0;
drop.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();if(!busy)$('file-input').click();}});
['dragenter','dragover'].forEach(event=>drop.addEventListener(event,e=>{e.preventDefault();if(!busy)drop.classList.add('dragging');}));
['dragleave','drop'].forEach(event=>drop.addEventListener(event,e=>{e.preventDefault();drop.classList.remove('dragging');}));
drop.addEventListener('drop',e=>{if(!busy&&e.dataTransfer.files[0])analyze(e.dataTransfer.files[0],'Sua foto');});
$('sample-button').addEventListener('click',async()=>{
  if(busy)return;
  try{
    const response=await fetch('./pasta.jpg');if(!response.ok)throw Error();
    await analyze(new File([await response.blob()],'massa.jpg',{type:'image/jpeg'}),'Massa ao pesto');
  }catch{status('Não foi possível carregar o exemplo. Tente novamente.',true);}
});
$('reset-button').addEventListener('click',()=>{
  $('upload-view').hidden=false;$('result-view').hidden=true;
  status('Sua foto fica no seu navegador. Sempre.');
});
