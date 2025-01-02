import{V as y,_ as L}from"./VContainer-7DaTe8TD.js";import{r as V,aE as x,U as I,at as l,au as u,av as c,c as N,az as T,J as b,aA as S,R as t,ay as w,aw as h,ax as _}from"./index-BOWKEjFH.js";import{W as k,P as $,Q as B,X as C}from"./VList-Dbb76nCL.js";const E={class:"text-right",style:{"font-size":"12px"}},P={__name:"Station",props:{stationName:{type:String,required:!0}},setup(e){const r=V(0),a=x(),p=e,f=n=>{const o=Math.floor(n/60),s=Math.round(n%60);return`${o}:${s<10?"0":""}${s}`},d=()=>{const n=a.stations[p.stationName].now,o=new Date().getTime(),s=n.endTime-n.startTime,i=(o-n.startTime*1e3)/1e3;return{percentage:i/s*100,elapsedTime:f(i),totalTime:f(s)}};var m=d();const v=()=>{document.hidden?clearInterval(g):g=setInterval(()=>{m=d(),r.value+=1},1e3)};document.addEventListener("visibilitychange",v),I(()=>{document.removeEventListener("visibilitychange",v),clearInterval(g)});let g=setInterval(()=>{m=d(),r.value+=1},1e3);return(n,o)=>{const s=L;return l(),u(y,null,{default:c(()=>[N(k,{class:"align-centerfill-height mx-auto","max-width":"900"},{default:c(()=>[N($,null,{default:c(()=>[(l(!0),T(b,null,S(t(a).stations,i=>(l(),T(b,{key:i.stationName},[i.stationName===e.stationName?(l(),u(B,{key:0},{default:c(()=>[N(s,{stationName:i.stationName,stationLabel:t(a).stations[e.stationName].stationLabel,songTitle:t(a).stations[e.stationName].now.firstLine.title,artist:t(a).stations[e.stationName].now.secondLine.title,image:t(a).stations[e.stationName].now.visuals.card.webpSrc,route:"/",routeIcon:"mdi-view-list",label:t(a).stations[e.stationName].now.song.release.label,albumTitle:t(a).stations[e.stationName].now.song.release.title,albumYear:t(a).stations[e.stationName].now.song.year},{default:c(()=>[o[0]||(o[0]=w("br",null,null,-1)),(l(),u(C,{key:r.value,"model-value":t(m).percentage},null,8,["model-value"])),w("div",E,h(t(m).elapsedTime)+"/"+h(t(m).totalTime),1)]),_:2},1032,["stationName","stationLabel","songTitle","artist","image","label","albumTitle","albumYear"])]),_:2},1024)):_("",!0)],64))),128))]),_:1})]),_:1})]),_:1})}}},R={__name:"[stationName]",setup(e){return(r,a)=>(l(),u(P,{stationName:r.$route.params.stationName},null,8,["stationName"]))}};export{R as default};