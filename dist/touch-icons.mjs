const paths={
 catch:'<circle cx="12" cy="12" r="4"/><path d="M4 8V4h4m8 0h4v4m0 8v4h-4m-8 0H4v-4"/>',
 jump:'<path d="m6 8 6-6 6 6M12 3v11m-7 7h14m-3-4 3 4-3 2M8 17l-3 4 3 2"/>',
 prone:'<circle cx="19" cy="15" r="2"/><path d="M3 20h18M4 16l5-2 5 2h2m-8-2-3-4"/>',
 gather:'<path d="m14 3 4 4m-2-2L8 16m-4-3 7 6-4 3-5-5z"/><path d="M14 18h7m-5-4h.01M20 11h.01"/>',
 pour:'<path d="M13 4h5v4l3 4v9h-11v-9l3-4zM3 3l5 3-1 6M3 9h.01M5 13h.01M4 17h.01"/>',
 right:'<path d="M12 8h4v4l3 4v6H9v-6l3-4zM3 13V8a5 5 0 0 1 5-5h4m-3-2 3 2-3 3"/>',
 height:'<path d="M4 5h16M4 12h16M4 19h16m-9-4 3-3-3-3"/>',
 fullscreen:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
 view:'<path d="m12 3 9 5v8l-9 5-9-5V8zM3 8l9 5 9-5M12 13v8"/>'
};
export const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]??paths.catch}</svg>`;
