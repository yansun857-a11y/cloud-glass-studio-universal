(() => {
'use strict';
const MODULE='cloud_glass_studio_universal', ROOT_ID='cloud-glass-studio-universal', STYLE_ID='cgs2-dynamic-region-style';
const DEFAULTS={
 blur:8, opacity:42, barOpacity:32, glassColor:'#e5edf2',
 adapterProfile:'native', font:'serif', fontSize:1, bodyColor:'#263744',
 secondaryColor:'#626d75', quoteColor:'#476c70',
 regions:{
  chatCanvas:{enabled:true,selector:'#chat'},
  messages:{enabled:true,selector:'#chat .mes:not([is_system="true"])'},
  topbar:{enabled:true,selector:'#top-bar, #top-settings-holder > .drawer'},
  composer:{enabled:true,selector:'#send_form'},
  popups:{enabled:false,selector:'.popup, .context-menu, .mes_buttons .dropdown-menu'},
  panels:{enabled:false,selector:'.drawer-content, #left-nav-panel, #right-nav-panel, #extensions_settings2 .inline-drawer-content, #extensions_settings .inline-drawer-content'}
 },
 templates:[]
};
const ADAPTERS={
 native:{chatCanvas:'#chat',messages:'#chat .mes:not([is_system="true"])',topbar:'#top-bar',composer:'#send_form',popups:'.popup, .context-menu, .mes_buttons .dropdown-menu',panels:'.drawer-content, #left-nav-panel, #right-nav-panel, #extensions_settings2 .inline-drawer-content, #extensions_settings .inline-drawer-content'},
 baseL:{chatCanvas:'#chat',messages:'#chat .mes:not([is_system="true"])',topbar:'#top-bar',composer:'#send_form',popups:'.popup',panels:'.drawer-content, #left-nav-panel, #right-nav-panel, #extensions_settings .inline-drawer-content, #extensions_settings2 .inline-drawer-content'},
 duoBox:{chatCanvas:'#chat',messages:'#chat .mes:not([is_system="true"])',topbar:'#top-bar',composer:'#send_form',popups:'.popup:not(.transparent_dialogue_popup), #dialogue_popup, #select_chat_popup, .draggable',panels:'.drawer-content, #left-nav-panel, #right-nav-panel, #extensions_settings .inline-drawer-content, #extensions_settings2 .inline-drawer-content'}
};
const STARTER=[
 {id:'sky',name:'☁️ 晴空云雾',values:{blur:9,opacity:38,barOpacity:30,glassColor:'#e5edf2',font:'serif',fontSize:1,bodyColor:'#263744',secondaryColor:'#65727b',quoteColor:'#4c7180'}},
 {id:'forest',name:'🌿 森林手札',values:{blur:7,opacity:55,barOpacity:40,glassColor:'#c9ddce',font:'serif',fontSize:1,bodyColor:'#203b30',secondaryColor:'#59685d',quoteColor:'#326348'}},
 {id:'rose',name:'🌸 玫瑰旧笺',values:{blur:10,opacity:45,barOpacity:34,glassColor:'#ead5d8',font:'serif',fontSize:1,bodyColor:'#49353d',secondaryColor:'#79666e',quoteColor:'#925c70'}},
 {id:'midnight',name:'🌙 午夜星河',values:{blur:14,opacity:62,barOpacity:48,glassColor:'#252b3b',font:'serif',fontSize:1,bodyColor:'#edf0f7',secondaryColor:'#b5bdce',quoteColor:'#b9a5df'}}
];
let settings,saveTimer,refreshTimer,observer;
const clone=v=>JSON.parse(JSON.stringify(v));
function merge(saved){
 const s=clone(DEFAULTS); if(!saved||typeof saved!=='object')return s;
 for(const [k,v] of Object.entries(saved)){if(k==='regions'&&v){for(const [r,c] of Object.entries(v))if(s.regions[r])s.regions[r]={...s.regions[r],...c};}else if(k in s)s[k]=v;}
 if(!Array.isArray(s.templates))s.templates=[];
 if(!s.templates.length)s.templates=clone(STARTER);
 // Migration safety: older 2.2.0 settings may have enabled blur on layout containers.
 s.regions.popups.enabled=false;
 s.regions.panels.enabled=false;
 const profile=ADAPTERS[s.adapterProfile]?s.adapterProfile:'native';
 s.adapterProfile=profile;
 for(const [key,selector] of Object.entries(ADAPTERS[profile])){
  s.regions[key].selector=selector;
  if(key==='topbar')s.regions[key].enabled=true;
 }
 return s;
}
function getSettings(){const c=SillyTavern.getContext();c.extensionSettings[MODULE]=merge(c.extensionSettings[MODULE]);return c.extensionSettings[MODULE];}
function rgb(h){let v=String(h||'').replace('#','');if(!/^[\da-f]{6}$/i.test(v))v='e5edf2';return [0,2,4].map(i=>parseInt(v.slice(i,i+2),16));}
function rgba(h,a){return `rgba(${rgb(h).join(',')},${Math.max(0,Math.min(1,a))})`;}
function styleNode(){let n=document.getElementById(STYLE_ID);if(!n){n=document.createElement('style');n.id=STYLE_ID;document.head.appendChild(n);}return n;}
function refreshTargets(){
 document.querySelectorAll('[data-cgs2-region]').forEach(e=>e.removeAttribute('data-cgs2-region'));
 const rules=[];
 for(const [region,c] of Object.entries(settings.regions)){if(!c.enabled||!c.selector)continue;try{document.querySelectorAll(c.selector).forEach(e=>e.setAttribute('data-cgs2-region',region));}catch(e){console.warn('[云雾玻璃] 无效适配选择器',region,e);}}
 styleNode().textContent=rules.join('\n');
}
function apply(){
 const r=document.documentElement;
 r.style.setProperty('--cgs2-blur',`${+settings.blur||0}px`);
 r.style.setProperty('--cgs2-fill',rgba(settings.glassColor,(+settings.opacity||0)/100));
 r.style.setProperty('--cgs2-bar-fill',rgba(settings.glassColor,(+settings.barOpacity||0)/100));
 r.style.setProperty('--cgs2-font',`"${String(settings.font).replace(/["\\]/g,'')}", "Noto Serif SC", serif`);
 r.style.setProperty('--cgs2-font-size',`${+settings.fontSize||1}rem`);
 r.style.setProperty('--cgs2-body-color',settings.bodyColor);
 r.style.setProperty('--cgs2-secondary-color',settings.secondaryColor);
 r.style.setProperty('--cgs2-quote-color',settings.quoteColor);
 r.classList.add('cgs2-typography-on');
 refreshTargets();syncControls();
}
function syncControls(){
 const p=document.getElementById(ROOT_ID);if(!p)return;
 p.querySelectorAll('[data-cgs2-key]').forEach(el=>{const v=settings[el.dataset.cgs2Key];if(v===undefined||document.activeElement===el)return;el.value=v;const o=p.querySelector(`[data-cgs2-output="${el.dataset.cgs2Key}"]`);if(o)o.textContent=el.dataset.cgs2Key==='blur'?`${v} px`:['opacity','barOpacity'].includes(el.dataset.cgs2Key)?`${v}%`:`${Number(v).toFixed(2)} rem`;});
 renderTemplates();
}
function saveSoon(){const s=document.querySelector(`#${ROOT_ID} [data-cgs2-status]`);if(s)s.textContent='正在保存…';clearTimeout(saveTimer);saveTimer=setTimeout(()=>{SillyTavern.getContext().saveSettingsDebounced();if(s)s.textContent='已自动保存';},250);}
function update(el){const k=el.dataset.cgs2Key;if(!(k in DEFAULTS))return;settings[k]=el.type==='range'?Number(el.value):el.value;apply();saveSoon();}
function applyAdapter(name){if(!ADAPTERS[name])return;settings.adapterProfile=name;for(const [k,v] of Object.entries(ADAPTERS[name]))settings.regions[k]={...(settings.regions[k]||{}),enabled:!['popups','panels'].includes(k),selector:v};apply();saveSoon();}
function snapshot(){return Object.fromEntries(['blur','opacity','barOpacity','glassColor','font','fontSize','bodyColor','secondaryColor','quoteColor'].map(k=>[k,settings[k]]));}
function applyTemplate(id){const t=settings.templates.find(x=>x.id===id);if(!t)return;Object.assign(settings,t.values);apply();saveSoon();}
function renderTemplates(){
 const box=document.querySelector(`#${ROOT_ID} [data-cgs2-template-list]`);if(!box)return;
 box.innerHTML='';
 settings.templates.forEach(t=>{const row=document.createElement('div');row.className='cgs2-template-row';const name=document.createElement('span');name.textContent=t.name;const use=document.createElement('button');use.type='button';use.textContent='应用';use.dataset.applyTemplate=t.id;const rename=document.createElement('button');rename.type='button';rename.textContent='改名';rename.dataset.renameTemplate=t.id;const del=document.createElement('button');del.type='button';del.textContent='删除';del.dataset.deleteTemplate=t.id;row.append(name,use,rename,del);box.appendChild(row);});
}
function saveTemplate(){
 const name=prompt('给这套模板起个名字：');if(!name||!name.trim())return;
 settings.templates.push({id:`custom-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name:name.trim(),values:snapshot()});saveSoon();renderTemplates();
}
async function mount(){
 const target=document.querySelector('#extensions_settings2')||document.querySelector('#extensions_settings');if(!target||document.getElementById(ROOT_ID))return;
 const html=await SillyTavern.getContext().renderExtensionTemplateAsync('third-party/cloud-glass-studio-universal','settings');target.insertAdjacentHTML('beforeend',html);
 const p=document.getElementById(ROOT_ID);if(!p)return;
 p.addEventListener('input',e=>{if(e.target.matches('[data-cgs2-key]'))update(e.target);});
 p.addEventListener('change',e=>{if(e.target.matches('[data-cgs2-key]'))update(e.target);if(e.target.matches('[data-cgs2-adapter]'))applyAdapter(e.target.value);});
 p.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.cgs2Preset){applyTemplate(b.dataset.cgs2Preset);return;}
  if(b.dataset.applyTemplate){applyTemplate(b.dataset.applyTemplate);return;}
  if(b.dataset.renameTemplate){const t=settings.templates.find(x=>x.id===b.dataset.renameTemplate);if(t){const name=prompt('修改模板名称：',t.name);if(name&&name.trim()){t.name=name.trim();saveSoon();renderTemplates();}}return;}
  if(b.dataset.deleteTemplate){const t=settings.templates.find(x=>x.id===b.dataset.deleteTemplate);if(t&&confirm(`删除模板“${t.name}”？`)){settings.templates=settings.templates.filter(x=>x.id!==t.id);saveSoon();renderTemplates();}return;}
  if(b.matches('[data-save-template]')){saveTemplate();return;}
  if(b.matches('[data-cgs2-reset]')){Object.assign(settings,clone(DEFAULTS));settings.templates=settings.templates.length?settings.templates:clone(STARTER);apply();saveSoon();}
 });
 const a=p.querySelector('[data-cgs2-adapter]');if(a)a.value=settings.adapterProfile||'native';
 syncControls();
}
function watch(){if(observer||!document.documentElement)return;observer=new MutationObserver(()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(refreshTargets,180);});observer.observe(document.documentElement,{childList:true,subtree:true});}
async function init(){try{settings=getSettings();apply();await mount();watch();console.info('[云雾玻璃控制台] 简洁通用版已加载');}catch(e){console.error('[云雾玻璃控制台] 初始化失败',e);}}
if(window.jQuery)window.jQuery(init);else document.addEventListener('DOMContentLoaded',init,{once:true});
})();