let runtime;
async function initialize() {
  importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js');
  const py = await loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/'});
  await py.loadPackage(['numpy','pillow']);
  const [code, model] = await Promise.all([
    fetch('./inference.py').then(r => { if(!r.ok) throw Error('Código indisponível'); return r.text(); }),
    fetch('./model.json').then(r => { if(!r.ok) throw Error('Modelo indisponível'); return r.text(); })
  ]);
  await py.runPythonAsync(code);
  py.globals.set('model_json', model);
  py.runPython('model = json.loads(model_json)');
  return py;
}
self.onmessage = async ({data}) => {
  try {
    if (!runtime) runtime = initialize().catch(e=>{runtime=null;throw e;});
    const py = await runtime;
    py.globals.set('image_bytes', new Uint8Array(data.bytes));
    const price = await py.runPythonAsync('estimate(bytes(image_bytes.to_py()), model)');
    py.globals.delete('image_bytes');
    if (!Number.isFinite(price) || price <= 0) throw Error('O modelo não encontrou uma estimativa válida para esta imagem. Tente outra foto.');
    self.postMessage({id:data.id, price});
  } catch(error) { self.postMessage({id:data.id, error:error.message || 'Não foi possível analisar esta imagem.'}); }
};
