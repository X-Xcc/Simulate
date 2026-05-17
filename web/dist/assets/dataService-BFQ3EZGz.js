import{c as r,r as d,j as o,C as g,d as x,m as i,n as v,o as u,p as w,q as m,t as C}from"./index-C-XI6eyO.js";/**
 * @license lucide-react v0.474.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=[["path",{d:"M3 3v16a2 2 0 0 0 2 2h16",key:"c24i48"}],["path",{d:"M18 17V9",key:"2bz60n"}],["path",{d:"M13 17V5",key:"1frdt8"}],["path",{d:"M8 17v-3",key:"17ska0"}]],M=r("ChartColumn",k);/**
 * @license lucide-react v0.474.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const N=[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]],O=r("ChevronLeft",N);/**
 * @license lucide-react v0.474.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _=[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]],$=r("ChevronRight",_);/**
 * @license lucide-react v0.474.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const b=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}]],R=r("Square",b);/**
 * @license lucide-react v0.474.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const I=[["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6",key:"4alrt4"}],["path",{d:"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2",key:"v07s0e"}],["line",{x1:"10",x2:"10",y1:"11",y2:"17",key:"1uufr5"}],["line",{x1:"14",x2:"14",y1:"11",y2:"17",key:"xtxkd"}]],F=r("Trash2",I);/**
 * @license lucide-react v0.474.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S=[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]],j=r("X",S),y=d.createContext({show:()=>{}}),z=()=>d.useContext(y);function A({children:e}){const[n,a]=d.useState([]),t=d.useCallback((s,h="success")=>{const c=Date.now().toString(36)+Math.random().toString(36).slice(2,6);a(p=>[...p,{id:c,message:s,type:h}]),setTimeout(()=>a(p=>p.filter(l=>l.id!==c)),3e3)},[]);return o.jsxs(y.Provider,{value:{show:t},children:[e,o.jsx("div",{className:"fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none",children:n.map(s=>o.jsxs("div",{className:x("pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-body font-semibold animate-fade-in-up",s.type==="error"?"bg-danger-red text-white":"bg-white border border-outline-variant text-on-surface"),children:[o.jsx(g,{size:16,className:s.type==="error"?"text-white":"text-success-green"}),s.message,o.jsx("button",{onClick:()=>a(h=>h.filter(c=>c.id!==s.id)),className:"ml-2 p-0.5 rounded hover:bg-black/10",children:o.jsx(j,{size:12})})]},s.id))})]})}var f=(e=>(e.ONLINE="online",e.OFFLINE="offline",e.SIGNAL_LOST="signal_lost",e))(f||{}),L=(e=>(e.CRITICAL="high",e.WARNING="medium",e.MINOR="minor",e.INFO="low",e))(L||{}),T=(e=>(e.FIGHT="打架",e.FALL="跌倒",e.CROWD="人员聚集",e.ABSENCE="离岗",e))(T||{});async function P(e){const n=await u("/api/camera_config",e);if(!Array.isArray(n))return[];let a=new Set;try{const t=await u("/api/cameras",e);a=new Set(t.cameras||[])}catch{}return n.map(t=>({id:t.id||"",name:t.name||"未命名",type:t.type||"usb",address:t.address??"",user:t.user,password:t.password,brand:t.brand,model:t.model,go2rtcId:t.go2rtcId,ip:t.ip,port:t.port,status:a.has(t.id||"")?f.ONLINE:f.OFFLINE,streamUrl:t.id?`/video_feed?cam=${t.id}`:"",personCount:0}))}async function q(e,n){const a=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:e,password:n})});if(!a.ok){const s=await a.json().catch(()=>({error:"登录失败"}));throw new Error(s.error||"登录失败")}const t=await a.json();w(t.token)}async function D(e){await i("/api/camera_config",e)}async function G(e,n){await m(`/api/camera_config/${e}`,n)}async function V(e){await C(`/api/camera_config/${e}`)}async function U(e){return i("/api/camera_config/test",e)}async function H(e,n){return i("/api/screenshot",{type:e,cameraIds:n})}async function W(e,n){const a=new URLSearchParams;return e.date&&a.set("date",e.date),e.camera&&a.set("camera",e.camera),e.type&&a.set("type",e.type),e.page!=null&&a.set("page",String(e.page)),a.set("size",String(e.size)),u(`/api/evidence/list?${a.toString()}`,n)}function X(){v("/api/export/csv")}async function B(e,n){return m(`/api/annotations/${encodeURIComponent(e)}`,n)}async function J(){const e=await i("/api/discover",void 0);return Array.isArray(e)?e:(e==null?void 0:e.data)??[]}async function K(e){return await i("/api/camera_config/batch",e)??{added:0,errors:[]}}export{L as A,f as C,R as S,F as T,j as X,T as a,O as b,$ as c,D as d,X as e,P as f,G as g,V as h,U as i,J as j,K as k,W as l,q as m,M as n,A as o,B as s,H as t,z as u};
