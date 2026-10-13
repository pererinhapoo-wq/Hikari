import{o as e,t}from"./react-3UH9BYTF.js";import{t as n}from"./link-e077Lqk2.js";import{t as r}from"./chevron-right-CdyIGgck.js";import{t as i}from"./play-BS5Aj0BT.js";import{I as a,L as o,O as s,U as c,V as l,bt as u,k as d,lt as f,xt as p}from"./index-KIU_Jf0J.js";import{t as m}from"./button-C62YKYu9.js";import{t as h}from"./badge-CinuV-Jk.js";var g=e(t(),1),_=f(),v=`/app/applet/src/components/hero.tsx`;function y({anime:e,animes:t=[e]}){let[r,s]=(0,g.useState)(0),[d,f]=(0,g.useState)(e.cover||e.banner||``),[y,b]=(0,g.useState)(!1),[x,S]=(0,g.useState)(null),C=t[r]??e,w=c(C),T=l(e=>e.myList.includes(C.id)),E=l(e=>e.toggleList),D=C.cover||C.banner||``,O=C.banner||C.cover||``;function k(e,t){if(!e){S(null),b(!1),t?.();return}let n=new Image;n.onload=()=>{let e=n.naturalWidth,r=n.naturalHeight;e>0&&r>0&&(b(e>r),S(e/r)),t?.()},n.src=e}return(0,g.useEffect)(()=>{k(d)},[d]),(0,g.useEffect)(()=>{if(t.length<2)return;let e=window.setInterval(()=>{let e=(r+1)%t.length,n=t[e],i=n?.cover||n?.banner||``;if(!i){s(e);return}let a=new Image;a.onload=()=>{let t=a.naturalWidth,n=a.naturalHeight;t>0&&n>0&&(b(t>n),S(t/n)),f(i),s(e)},a.src=i},8e3);return()=>window.clearInterval(e)},[t,r]),(0,_.jsxDEV)(`section`,{className:`
        relative
        -mx-4
        overflow-hidden
        bg-bg
        sm:-mx-6
      `,children:[d?(0,_.jsxDEV)(`div`,{className:`
            relative
            w-full
            overflow-hidden
            bg-bg
            h-[14rem]
            sm:h-[21rem]
            md:h-[21rem]
          `,style:void 0,children:[(0,_.jsxDEV)(`img`,{src:D,alt:``,"aria-hidden":`true`,className:`
              absolute
              inset-0
              size-full
              object-contain
              object-center
              md:hidden
            `},void 0,!1,{fileName:v,lineNumber:154,columnNumber:11},this),(0,_.jsxDEV)(`img`,{src:O,alt:``,"aria-hidden":`true`,className:`
              absolute
              inset-0
              hidden
              size-full
              object-cover
              object-center
              md:block
            `},void 0,!1,{fileName:v,lineNumber:172,columnNumber:11},this),(0,_.jsxDEV)(`div`,{className:`
              pointer-events-none
              absolute
              inset-x-0
              bottom-0
              h-1/2
              bg-linear-to-t
              from-bg
              via-bg/40
              to-transparent
            `},void 0,!1,{fileName:v,lineNumber:188,columnNumber:11},this),(0,_.jsxDEV)(`div`,{className:`
              pointer-events-none
              absolute
              inset-0
              hidden
              md:block
              bg-linear-to-r
              from-bg/80
              via-bg/20
              to-transparent
            `},void 0,!1,{fileName:v,lineNumber:203,columnNumber:11},this)]},void 0,!0,{fileName:v,lineNumber:134,columnNumber:9},this):(0,_.jsxDEV)(`div`,{className:`
            h-[14rem]
            bg-bg
            sm:h-[21rem]
            md:h-[21rem]
          `},void 0,!1,{fileName:v,lineNumber:218,columnNumber:9},this),(0,_.jsxDEV)(`div`,{className:`
          relative
          z-10
          px-4
          pb-3
          pt-1
          sm:px-6
          sm:pb-7
          sm:pt-2
          md:-mt-32
          md:px-10
          md:pb-10
        `,children:[(0,_.jsxDEV)(`p`,{className:`
            text-[8px]
            font-medium
            tracking-[0.2em]
            text-muted
            uppercase
            sm:text-[9px]
            md:text-xs
          `,children:`Em destaque`},void 0,!1,{fileName:v,lineNumber:244,columnNumber:9},this),(0,_.jsxDEV)(`h1`,{className:`
            mt-0.5
            max-w-2xl
            line-clamp-2
            font-display
            text-[1.65rem]
            leading-tight
            tracking-tight
            text-fg
            sm:text-4xl
            md:text-5xl
          `,children:w},void 0,!1,{fileName:v,lineNumber:258,columnNumber:9},this),C.titles.native&&C.titles.native!==w&&(0,_.jsxDEV)(`p`,{className:`mt-0.5 hidden font-display text-sm text-muted sm:block`,children:C.titles.native},void 0,!1,{fileName:v,lineNumber:277,columnNumber:13},this),(0,_.jsxDEV)(`div`,{className:`mt-1.5 flex flex-wrap items-center gap-1.5`,children:[C.score!=null&&(0,_.jsxDEV)(`span`,{className:`text-xs font-medium tabular-nums text-score sm:text-sm`,children:o(C.score)},void 0,!1,{fileName:v,lineNumber:284,columnNumber:13},this),C.year&&(0,_.jsxDEV)(`span`,{className:`text-xs text-muted sm:text-sm`,children:C.year},void 0,!1,{fileName:v,lineNumber:290,columnNumber:13},this),C.genres.slice(0,2).map(e=>(0,_.jsxDEV)(h,{className:`text-[9px] sm:text-xs`,children:a(e)},e,!1,{fileName:v,lineNumber:296,columnNumber:13},this))]},void 0,!0,{fileName:v,lineNumber:282,columnNumber:9},this),C.synopsis&&(0,_.jsxDEV)(`p`,{className:`
              mt-1.5
              max-w-xl
              line-clamp-2
              text-[10px]
              leading-snug
              text-muted
              sm:mt-4
              sm:line-clamp-3
              sm:text-sm
              md:max-w-2xl
              md:text-base
            `,children:C.synopsis},void 0,!1,{fileName:v,lineNumber:306,columnNumber:11},this),(0,_.jsxDEV)(`div`,{className:`mt-2.5 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2`,children:[(0,_.jsxDEV)(m,{asChild:!0,size:`sm`,children:(0,_.jsxDEV)(n,{to:`/watch/$id`,params:{id:C.id},children:[(0,_.jsxDEV)(i,{className:`size-3.5 sm:size-4`},void 0,!1,{fileName:v,lineNumber:331,columnNumber:15},this),`Assistir`]},void 0,!0,{fileName:v,lineNumber:327,columnNumber:13},this)},void 0,!1,{fileName:v,lineNumber:326,columnNumber:11},this),(0,_.jsxDEV)(m,{type:`button`,variant:`outline`,size:`sm`,onClick:()=>E(C),children:[T?(0,_.jsxDEV)(p,{className:`size-3.5 sm:size-4`},void 0,!1,{fileName:v,lineNumber:343,columnNumber:15},this):(0,_.jsxDEV)(u,{className:`size-3.5 sm:size-4`},void 0,!1,{fileName:v,lineNumber:345,columnNumber:15},this),(0,_.jsxDEV)(`span`,{className:`hidden sm:inline`,children:T?`Na lista`:`Minha Lista`},void 0,!1,{fileName:v,lineNumber:348,columnNumber:13},this)]},void 0,!0,{fileName:v,lineNumber:336,columnNumber:11},this),(0,_.jsxDEV)(m,{asChild:!0,variant:`ghost`,size:`sm`,children:(0,_.jsxDEV)(n,{to:`/anime/$id`,params:{id:C.id},children:`Detalhes`},void 0,!1,{fileName:v,lineNumber:358,columnNumber:13},this)},void 0,!1,{fileName:v,lineNumber:353,columnNumber:11},this)]},void 0,!0,{fileName:v,lineNumber:325,columnNumber:9},this),t.length>1&&(0,_.jsxDEV)(`div`,{className:`
              mt-2.5
              flex
              items-center
              gap-1.5
              sm:mt-3
            `,"aria-label":`Destaques`,children:t.map((e,t)=>(0,_.jsxDEV)(`button`,{type:`button`,"aria-label":`Mostrar destaque ${t+1}`,onClick:()=>{if(t===r)return;let n=e.cover||e.banner||``;if(!n){s(t);return}let i=new Image;i.onload=()=>{let e=i.naturalWidth,r=i.naturalHeight;e>0&&r>0&&(b(e>r),S(e/r)),f(n),s(t)},i.src=n},className:`
                  h-1.5
                  rounded-full
                  transition-all
                  ${t===r?`w-5 bg-fg`:`w-1.5 bg-fg/40`}
                `},e.id,!1,{fileName:v,lineNumber:379,columnNumber:15},this))},void 0,!1,{fileName:v,lineNumber:368,columnNumber:11},this)]},void 0,!0,{fileName:v,lineNumber:229,columnNumber:7},this)]},void 0,!0,{fileName:v,lineNumber:123,columnNumber:5},this)}var b=`/app/applet/src/components/anime-row.tsx`;function x({title:e,href:t,items:i,loading:a}){return!a&&i.length===0?null:(0,_.jsxDEV)(`section`,{className:`space-y-3`,children:[(0,_.jsxDEV)(`div`,{className:`flex items-center justify-between gap-3 px-1`,children:[(0,_.jsxDEV)(`h2`,{className:`font-display text-lg tracking-tight text-fg sm:text-2xl`,children:e},void 0,!1,{fileName:b,lineNumber:26,columnNumber:9},this),t&&(0,_.jsxDEV)(n,{to:t,className:`
              inline-flex
              min-h-9
              shrink-0
              items-center
              gap-0.5
              rounded-md
              px-1
              text-[10px]
              font-medium
              tracking-wide
              text-muted
              uppercase
              transition-colors
              hover:text-fg
              sm:text-xs
            `,children:[`Ver tudo`,(0,_.jsxDEV)(r,{className:`size-3.5`},void 0,!1,{fileName:b,lineNumber:52,columnNumber:13},this)]},void 0,!0,{fileName:b,lineNumber:31,columnNumber:11},this)]},void 0,!0,{fileName:b,lineNumber:25,columnNumber:7},this),(0,_.jsxDEV)(`div`,{className:`rail -mx-4 px-4 sm:-mx-6 sm:px-6`,children:a?Array.from({length:8},(e,t)=>(0,_.jsxDEV)(d,{},t,!1,{fileName:b,lineNumber:60,columnNumber:15},this)):i.map(e=>(0,_.jsxDEV)(s,{anime:e},e.id,!1,{fileName:b,lineNumber:63,columnNumber:15},this))},void 0,!1,{fileName:b,lineNumber:57,columnNumber:7},this)]},void 0,!0,{fileName:b,lineNumber:24,columnNumber:5},this)}export{y as n,x as t};