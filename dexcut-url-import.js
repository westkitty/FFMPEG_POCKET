/* DEX//CUT optional URL importer. Media stays local after acquisition. */
(() => {
'use strict';
const panel=document.querySelector('#filePanel');
if(!panel||panel.querySelector('.urlImport'))return;
const root=document.createElement('section');
root.className='urlImport';
root.setAttribute('aria-label','Import media from URL');
root.innerHTML=`<details><summary>IMPORT FROM URL</summary><form id="urlImportForm">
<label for="urlImportLink">Media or post URL</label><input id="urlImportLink" type="url" required placeholder="https://…" autocomplete="off" inputmode="url">
<label for="urlImportService">Optional downloader service URL (HTTPS)</label><input id="urlImportService" type="url" placeholder="https://your-service.example/" autocomplete="off" inputmode="url">
<p>Direct media is fetched in this browser. Other sites require your own explicitly configured service. The URL is sent to that service only when you choose it. Never enter cookies, passwords or access tokens.</p>
<label><input id="urlImportConsent" type="checkbox"> I authorize sending this link to my configured service.</label>
<div class="urlImportActions"><button type="submit" id="urlImportGo">IMPORT MEDIA</button><button type="button" id="urlImportCancel" disabled>CANCEL</button></div>
<progress id="urlImportProgress" max="100" value="0" hidden></progress><p id="urlImportStatus" role="status" aria-live="polite"></p>
</form></details>`;
panel.append(root);
const form=root.querySelector('form'),link=root.querySelector('#urlImportLink'),service=root.querySelector('#urlImportService'),consent=root.querySelector('#urlImportConsent'),go=root.querySelector('#urlImportGo'),cancel=root.querySelector('#urlImportCancel'),status=root.querySelector('#urlImportStatus'),progress=root.querySelector('#urlImportProgress');
let controller=null;
const MAX_BYTES=250*1024*1024;
const DIRECT=/\.(mp4|m4v|mov|webm|mp3|m4a|wav|ogg|opus|aac|flac)(?:$|[?#])/i;
function validated(raw){const u=new URL(raw);if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw Error('Use an HTTPS URL.');if(u.username||u.password)throw Error('URLs containing credentials are not allowed.');return u;}
function filename(u,type){const ext=(type.split(';')[0].match(/(?:video|audio)\/(mp4|webm|mpeg|ogg|wav|quicktime|x-m4a)/)||[])[1]||'mp4';const suffix={mpeg:'mp3',quicktime:'mov','x-m4a':'m4a'}[ext]||ext;let pathPart=u.pathname.split('/').pop()||'download';try{pathPart=decodeURIComponent(pathPart)}catch(_){}const last=pathPart.replace(/[^a-z0-9._-]/gi,'_').slice(0,90);return /\.[a-z0-9]{2,5}$/i.test(last)?last:'import.'+suffix;}
async function fetchMedia(u,signal){
const response=await fetch(u.href,{signal,credentials:'omit',redirect:'follow',cache:'no-store'});
if(!response.ok)throw Error('Download failed (HTTP '+response.status+').');
const type=(response.headers.get('content-type')||'').toLowerCase();
if(!/^(video|audio)\//.test(type)&&!DIRECT.test(response.url))throw Error('The URL did not return a recognized media file.');
const len=Number(response.headers.get('content-length')||0);
if(len>MAX_BYTES)throw Error('File exceeds the 250 MiB import limit.');
if(!response.body)throw Error('Streaming downloads are unavailable in this browser.');
const reader=response.body.getReader(),chunks=[];let size=0;
while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES){await reader.cancel();throw Error('File exceeds the 600 MiB import limit.');}chunks.push(value);if(len){progress.hidden=false;progress.value=Math.min(100,Math.round(size/len*100));}status.textContent='Downloading '+Math.round(size/1048576)+' MiB…';}
if(!size)throw Error('The download was empty.');
return new File(chunks,filename(new URL(response.url),type),{type:/^(video|audio)\//.test(type)?type.split(';')[0]:'application/octet-stream'});
}
form.addEventListener('submit',async e=>{
e.preventDefault();if(controller)return;
try{
const source=validated(link.value.trim()),endpoint=service.value.trim()?validated(service.value.trim()):null;
if(endpoint&&!consent.checked)throw Error('Check the consent box before contacting the service.');
controller=new AbortController();go.disabled=true;cancel.disabled=false;progress.value=0;progress.hidden=true;
let media=source;
if(endpoint){
status.textContent='Requesting a media URL from the configured service…';
const reply=await fetch(endpoint.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:source.href}),signal:controller.signal,credentials:'omit',redirect:'error'});
if(!reply.ok)throw Error('Service request failed (HTTP '+reply.status+').');
if(!/application\/json/i.test(reply.headers.get('content-type')||''))throw Error('Service must return JSON.');
const json=await reply.json();
if(!json||typeof json.mediaUrl!=='string')throw Error('Service must return JSON with a mediaUrl string.');
media=validated(json.mediaUrl);
if(media.origin!==source.origin&&media.origin!==endpoint.origin)status.textContent='Downloading media from a third-party host…';
}else if(!DIRECT.test(source.pathname))throw Error('This site needs an optional downloader service. Configure one above.');
const file=await fetchMedia(media,controller.signal);
if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
document.dispatchEvent(new CustomEvent('dexcut:import-file',{detail:{file}}));
status.textContent='Imported '+file.name+'. Ready to edit.';
}catch(err){status.textContent=err.name==='AbortError'?'Import cancelled.':String(err.message||'Import failed.')+' (CORS or source restrictions may apply.)';}
finally{controller=null;go.disabled=false;cancel.disabled=true;}
});
cancel.addEventListener('click',()=>controller?.abort());
})();