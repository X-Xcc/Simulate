import{c as i,r as d,j as o,C as x,f as g,o as r,p as v,d as p,q as m,t as C}from"./index-B5SWaks7.js";/**
 * @license lucide-react v0.474.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w=[["path",{d:"M3 3v16a2 2 0 0 0 2 2h16",key:"c24i48"}],["path",{d:"M18 17V9",key:"2bz60n"}],["path",{d:"M13 17V5",key:"1frdt8"}],["path",{d:"M8 17v-3",key:"17ska0"}]],$=i("ChartColumn",w);/**
 * @license lucide-react v0.474.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]],E=i("ChevronLeft",k);/**
 * @license lucide-react v0.474.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const N=[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]],R=i("ChevronRight",N);/**
 * @license lucide-react v0.474.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}]],O=i("Square",_);/**
 * @license lucide-react v0.474.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const b=[["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6",key:"4alrt4"}],["path",{d:"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2",key:"v07s0e"}],["line",{x1:"10",x2:"10",y1:"11",y2:"17",key:"1uufr5"}],["line",{x1:"14",x2:"14",y1:"11",y2:"17",key:"xtxkd"}]],T=i("Trash2",b);/**
 * @license lucide-react v0.474.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const I=[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]],S=i("X",I),y=d.createContext({show:()=>{}}),F=()=>d.useContext(y);function z({children:e}){const[t,s]=d.useState([]),a=d.useCallback((n,u="success")=>{const c=Date.now().toString(36)+Math.random().toString(36).slice(2,6);s(h=>[...h,{id:c,message:n,type:u}]),setTimeout(()=>s(h=>h.filter(l=>l.id!==c)),3e3)},[]);return o.jsxs(y.Provider,{value:{show:a},children:[e,o.jsx("div",{className:"fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none",children:t.map(n=>o.jsxs("div",{className:g("pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-body font-semibold animate-fade-in-up",n.type==="error"?"bg-danger-red text-white":"bg-white border border-outline-variant text-on-surface"),children:[o.jsx(x,{size:16,className:n.type==="error"?"text-white":"text-success-green"}),n.message,o.jsx("button",{onClick:()=>s(u=>u.filter(c=>c.id!==n.id)),className:"ml-2 p-0.5 rounded hover:bg-black/10",children:o.jsx(S,{size:12})})]},n.id))})]})}var f=(e=>(e.ONLINE="online",e.OFFLINE="offline",e.SIGNAL_LOST="signal_lost",e))(f||{}),L=(e=>(e.CRITICAL="high",e.WARNING="medium",e.MINOR="minor",e.INFO="low",e))(L||{}),j=(e=>(e.FIGHT="打架",e.FALL="跌倒",e.CROWD="人员聚集",e.ABSENCE="离岗",e))(j||{});async function A(e){const t=await p("/api/camera_config",e);if(!Array.isArray(t))return[];let s=new Set;try{const a=await p("/api/cameras",e);s=new Set(a.cameras||[])}catch{}return t.map(a=>({id:a.id||"",name:a.name||"未命名",type:a.type||"usb",address:a.address??"",user:a.user,password:a.password,brand:a.brand,model:a.model,go2rtcId:a.go2rtcId,ip:a.ip,port:a.port,status:s.has(a.id||"")?f.ONLINE:f.OFFLINE,streamUrl:a.id?`/video_feed?cam=${a.id}`:"",personCount:0}))}async function q(e){await r("/api/camera_config",e)}async function P(e,t){await m(`/api/camera_config/${e}`,t)}async function D(e){await C(`/api/camera_config/${e}`)}async function G(e){return r("/api/camera_config/test",e)}async function V(e,t){return r("/api/screenshot",{type:e,cameraIds:t})}async function U(e,t){const s=new URLSearchParams;return e.date&&s.set("date",e.date),e.camera&&s.set("camera",e.camera),e.type&&s.set("type",e.type),e.page!=null&&s.set("page",String(e.page)),s.set("size",String(e.size)),p(`/api/evidence/list?${s.toString()}`,t)}function H(){v("/api/export/csv")}async function W(e,t){return m(`/api/annotations/${encodeURIComponent(e)}`,t)}async function X(){const e=await r("/api/discover",void 0);return Array.isArray(e)?e:(e==null?void 0:e.data)??[]}async function B(e){return await r("/api/camera_config/batch",e)??{added:0,errors:[]}}export{L as A,E as C,O as S,T,S as X,j as a,R as b,f as c,q as d,H as e,A as f,P as g,D as h,G as i,X as j,B as k,U as l,$ as m,z as n,W as s,V as t,F as u};
