import{c as i,r as c,j as o,C as g,d as x,m as v,n as u,s as w,o as d,p as m,q as C}from"./index-ComsqFVl.js";/**
 * @license lucide-react v0.474.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=[["path",{d:"M3 3v16a2 2 0 0 0 2 2h16",key:"c24i48"}],["path",{d:"M18 17V9",key:"2bz60n"}],["path",{d:"M13 17V5",key:"1frdt8"}],["path",{d:"M8 17v-3",key:"17ska0"}]],M=i("ChartColumn",k);/**
 * @license lucide-react v0.474.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const N=[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]],O=i("ChevronLeft",N);/**
 * @license lucide-react v0.474.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _=[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]],$=i("ChevronRight",_);/**
 * @license lucide-react v0.474.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const b=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}]],R=i("Square",b);/**
 * @license lucide-react v0.474.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const I=[["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6",key:"4alrt4"}],["path",{d:"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2",key:"v07s0e"}],["line",{x1:"10",x2:"10",y1:"11",y2:"17",key:"1uufr5"}],["line",{x1:"14",x2:"14",y1:"11",y2:"17",key:"xtxkd"}]],F=i("Trash2",I);/**
 * @license lucide-react v0.474.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S=[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]],j=i("X",S),y=c.createContext({show:()=>{}}),z=()=>c.useContext(y);function A({children:e}){const[n,t]=c.useState([]),a=c.useCallback((s,h="success")=>{const r=Date.now().toString(36)+Math.random().toString(36).slice(2,6);t(p=>[...p,{id:r,message:s,type:h}]),setTimeout(()=>t(p=>p.filter(l=>l.id!==r)),3e3)},[]);return o.jsxs(y.Provider,{value:{show:a},children:[e,o.jsx("div",{className:"fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none",children:n.map(s=>o.jsxs("div",{className:x("pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-body font-semibold animate-fade-in-up",s.type==="error"?"bg-danger-red text-white":"bg-white border border-outline-variant text-on-surface"),children:[o.jsx(g,{size:16,className:s.type==="error"?"text-white":"text-success-green"}),s.message,o.jsx("button",{onClick:()=>t(h=>h.filter(r=>r.id!==s.id)),className:"ml-2 p-0.5 rounded hover:bg-black/10",children:o.jsx(j,{size:12})})]},s.id))})]})}var f=(e=>(e.ONLINE="online",e.OFFLINE="offline",e.SIGNAL_LOST="signal_lost",e))(f||{}),L=(e=>(e.CRITICAL="high",e.WARNING="medium",e.MINOR="minor",e.INFO="low",e))(L||{}),T=(e=>(e.FIGHT="打架",e.FALL="跌倒",e.CROWD="人员聚集",e.ABSENCE="离岗",e))(T||{});async function P(e){const n=await u("/api/camera_config",e);if(!Array.isArray(n))return[];let t=new Set;try{const a=await u("/api/cameras",e);t=new Set(a.cameras||[])}catch{}return n.map(a=>({id:a.id||"",name:a.name||"未命名",type:a.type||"usb",address:a.address??"",user:a.user,password:a.password,brand:a.brand,model:a.model,go2rtcId:a.go2rtcId,ip:a.ip,port:a.port,status:t.has(a.id||"")?f.ONLINE:f.OFFLINE,streamUrl:a.id?`/video_feed?cam=${a.id}`:"",personCount:0}))}async function q(e,n){const t=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:e,password:n})});if(!t.ok){const s=await t.json().catch(()=>({error:"登录失败"}));throw new Error(s.error||"登录失败")}const a=await t.json();w(a.token)}async function D(e){await d("/api/camera_config",e)}async function G(e,n){await m(`/api/camera_config/${e}`,n)}async function V(e){await C(`/api/camera_config/${e}`)}async function U(e){return d("/api/camera_config/test",e)}async function H(e,n){const t=new URLSearchParams;return e.date&&t.set("date",e.date),e.camera&&t.set("camera",e.camera),e.type&&t.set("type",e.type),e.page!=null&&t.set("page",String(e.page)),t.set("size",String(e.size)),u(`/api/evidence/list?${t.toString()}`,n)}function W(){v("/api/export/csv")}async function X(e,n){return m(`/api/annotations/${encodeURIComponent(e)}`,n)}async function B(){const e=await d("/api/discover",void 0);return Array.isArray(e)?e:(e==null?void 0:e.data)??[]}async function J(e){return await d("/api/camera_config/batch",e)??{added:0,errors:[]}}export{L as A,f as C,R as S,F as T,j as X,T as a,O as b,$ as c,D as d,W as e,P as f,G as g,V as h,B as i,J as j,H as k,q as l,M as m,A as n,X as s,U as t,z as u};
