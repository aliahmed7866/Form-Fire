/* Decorative enquiry illustrations. Shared colours and short, optional CSS motion. */
function enquiryArt(key) {
  const ink='#252820',sage='#b8c69c',lime='#d6ee58',warm='#d89572',bone='#fffdf7';
  const line=`stroke="${ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"`;
  const bell=`<path d="M18 31h28" ${line}/><rect x="11" y="23" width="7" height="17" rx="3" fill="${sage}" ${line}/><rect x="18" y="19" width="7" height="25" rx="3" fill="${lime}" ${line}/><rect x="39" y="19" width="7" height="25" rx="3" fill="${lime}" ${line}/><rect x="46" y="23" width="7" height="17" rx="3" fill="${sage}" ${line}/>`;
  const bowl=`<path d="M12 31h40c-1 14-10 22-20 22S13 45 12 31Z" fill="${warm}" ${line}/><path d="M22 49h20M17 37h30" ${line}/><path d="M22 28c-6-11 2-17 8-9 4-13 15-10 13 3" fill="${sage}" ${line}/><path d="m27 23 7 6m2-11-2 11" ${line}/><circle cx="18" cy="27" r="5" fill="${lime}" ${line}/><circle cx="43" cy="27" r="5" fill="${bone}" ${line}/>`;
  const clock=`<circle cx="32" cy="33" r="19" fill="${bone}" ${line}/><path d="M32 19v15l9 5M27 8h10M32 8v6" ${line}/><circle cx="32" cy="33" r="2" fill="${ink}"/>`;
  const pictures={
    train:`<g transform="rotate(-12 32 32)">${bell}</g>`,
    eat:bowl,
    both:`<g transform="translate(-4 -1) scale(.76)">${bell}</g><g transform="translate(18 21) scale(.66)">${bowl}</g>`,
    strong:`<path d="M14 48c-1-9 3-21 8-26l6 4-3 11c9-7 20-5 25 2 3 6-3 13-14 13H22Z" fill="${warm}" ${line}/><path d="m22 22 2-8 10 2 2 6-8 4M25 37l-5 7M32 39c4-3 8-3 12 1" fill="none" ${line}/><path d="m43 14 2-5m3 10 5-1" ${line}/>`,
    food:`${bowl}<path d="M49 16v-5m-2 2h4" ${line}/>`,
    balance:`<circle cx="43" cy="17" r="8" fill="${warm}"/><path d="M17 43c-9-10-6-25 10-26 3 15-1 25-10 26Z" fill="${sage}" ${line}/><path d="m17 43 8-19M17 30l4 3" fill="none" ${line}/><path d="M10 51c14-8 30-8 44 0" fill="none" ${line}/><path d="M37 34c0-6 9-10 14-3 1 7-7 13-14 15-7-3-14-9-12-15 4-7 12-3 12 3Z" fill="${lime}" ${line}/>`,
    custom:`<path d="M13 49 17 37l24-24a5 5 0 0 1 7 7L24 44Z" fill="${warm}" ${line}/><path d="m17 37 7 7m12-26 7 7M13 49l11-5" fill="none" ${line}/><path d="m46 38 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="${lime}" ${line}/>`,
    short:`${clock}<path d="m13 13-4 4m42-4 4 4" ${line}/><path d="M32 19v14l12-5" fill="none" stroke="${warm}" stroke-width="3.2" stroke-linecap="round"/>`,
    regular:`<rect x="12" y="14" width="40" height="39" rx="6" fill="${bone}" ${line}/><path d="M12 25h40M22 10v9m20-9v9" ${line}/><rect x="19" y="32" width="8" height="8" rx="2" fill="${sage}"/><rect x="30" y="32" width="8" height="8" rx="2" fill="${lime}"/><rect x="41" y="32" width="5" height="8" rx="2" fill="${warm}"/><path d="m20 46 3 3 5-6" fill="none" ${line}/>`,
    flexible:`<path d="M12 48c-7-14 36-3 36-19 0-8-18-2-18-12" fill="none" stroke="${sage}" stroke-width="6" stroke-linecap="round"/><path d="M12 48c-7-14 36-3 36-19 0-8-18-2-18-12" fill="none" ${line}/><circle cx="12" cy="48" r="5" fill="${lime}" ${line}/><path d="M30 18c-12-8-8-18 0-13 8-5 12 5 0 13Z" fill="${warm}" ${line}/><path d="m45 12 2-5m3 10 5 1" ${line}/>`,
    dinner:`<circle cx="32" cy="33" r="19" fill="${bone}" ${line}/><circle cx="32" cy="33" r="13" fill="${sage}"/><path d="M8 17v13m-3-13v8a3 3 0 0 0 6 0v-8M8 30v20M57 17c-6 4-6 13 0 13V17Zm0 13v20" fill="none" ${line}/><path d="M32 28c-8-5-12 6 0 12 12-6 8-17 0-12Z" fill="${warm}"/>`,
    celebrate:`<path d="M13 47h38v7H13Z" fill="${sage}" ${line}/><path d="M17 31h30v16H17Z" fill="${warm}" ${line}/><path d="M17 31c2 6 5 6 8 0 2 7 6 7 8 0 3 6 7 6 9 0h5v7H17Z" fill="${bone}" ${line}/><path d="M24 31v-9m16 9v-9" ${line}/><path d="M24 20c-7-4-4-8 0-12 4 4 7 8 0 12Zm16 0c-7-4-4-8 0-12 4 4 7 8 0 12Z" fill="${lime}" ${line}/><path d="m7 19 2 4m43-8 4-3" ${line}/>`,
    prep:`<path d="M17 18h32a5 5 0 0 1 5 5v27a5 5 0 0 1-5 5H17a5 5 0 0 1-5-5V23a5 5 0 0 1 5-5Z" fill="${sage}" ${line}/><path d="M23 18V9h16v9" fill="${sage}" ${line}/><path d="m25 48 3-20 10 5-13 15Z" fill="${warm}" ${line}/><path d="m31 29 2-9m-1 4 8-3m-8 3-5-5" fill="none" ${line}/><path d="m40 43 9-14 5 3-10 16Z" fill="${bone}" ${line}/><path d="m44 48-3 5" ${line}/>`
  };
  const picture=Object.hasOwn(pictures,key)?pictures[key]:pictures.custom;
  return `<svg class="enquiry-card-art" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" focusable="false"><path d="M8 28C8 9 28 5 44 9c18 5 18 34 3 45C30 66 7 48 8 28Z" fill="#edf0e2"/><g class="enquiry-art-main">${picture}</g><g class="enquiry-art-spark" fill="${lime}" stroke="${ink}" stroke-width="1.5" stroke-linejoin="round"><path d="m53 5 1.6 4.4L59 11l-4.4 1.6L53 17l-1.6-4.4L47 11l4.4-1.6Z"/></g></svg>`;
}
