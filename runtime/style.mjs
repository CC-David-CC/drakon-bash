export const css = `
:host{display:flex;flex:1 1 auto;min-height:0;min-width:0;overflow:hidden;padding:0!important;container-type:inline-size;color:#192822;background:#f8f9f5;font:14px Inter,system-ui,sans-serif;text-align:left;color-scheme:light}
*{box-sizing:border-box}button,input,select,textarea{font:inherit}button{cursor:pointer}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,.canvas:focus-visible{outline:2px solid var(--accent);outline-offset:2px}button:disabled{opacity:.45;cursor:default}
.shell{display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;width:100%;height:100%;min-height:0;background:#f6f7f3;--border:#dbe0d8;--muted:#59675e}
.bar,.projectbar,.subhead,.bar-group,.tabstrip,.status,.palette,.controls{display:flex;align-items:center}.bar{gap:12px;padding:10px 16px;border-bottom:1px solid var(--border);background:#fff;min-height:52px}.bar-group{gap:7px;margin-left:auto}.brand{display:flex;align-items:center;gap:8px;font-weight:760;letter-spacing:-.027em;white-space:nowrap}.brand-mark{height:28px;width:28px;background:var(--accent);color:white;border-radius:7px;display:grid;place-items:center}.brand-mark svg{width:21px;height:21px}.tag{padding:4px 7px;color:var(--accent);background:var(--tint);border-radius:4px;font-size:11px;font-weight:710;letter-spacing:.015em}
.btn,.iconbtn,.pill,.tool,.switch button,.menubtn{display:inline-flex;align-items:center;justify-content:center;gap:6px;background:#fff;color:inherit;border:1px solid var(--border);border-radius:6px;min-height:30px;padding:4px 10px;font-size:12px;font-weight:570;line-height:1.3}.btn:hover,.iconbtn:hover,.pill:hover,.tool:hover{background:#f0f3ee}.btn.primary{background:var(--accent);border-color:var(--accent);color:white}.btn.primary:hover{filter:brightness(.94)}.iconbtn{width:30px;padding:0}.ico{display:inline-flex;flex:none}.ico svg{height:15px;width:15px;display:block}.split{position:relative;display:flex;align-items:stretch}.split>.btn{border-radius:6px 0 0 6px}.split>.iconbtn{border-left:0;width:24px;border-radius:0 6px 6px 0}
.projectbar{gap:10px;padding:8px 16px;border-bottom:1px solid var(--border);min-height:45px;background:#fafbf8}.projectname{border:0;background:none;padding:2px 0;color:#26382d;font-size:13px;font-weight:680;max-width:26%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.slash{color:#b0b9af}.fn-select{min-width:66px;max-width:190px;padding:3px 4px;border:0;background:transparent;color:#37443a;font:12px 'IBM Plex Mono',ui-monospace,monospace}.divider{height:17px;width:1px;background:var(--border)}.controls{margin-left:auto;gap:5px}.switch{display:none}
.work{min-height:0;display:grid;grid-template-columns:minmax(0,1.55fr) minmax(245px,1fr)}.board,.codepanel{position:relative;min-height:0;min-width:0;display:flex;flex-direction:column}.board{background:#f4f6f1}.subhead{height:44px;flex:none;padding:0 14px;gap:8px;color:#35473b;font-size:12px;font-weight:620}.subhead .controls{margin-left:auto}.subhead .iconbtn{width:26px;min-height:25px}.zoom{font:11px ui-monospace,monospace;min-width:36px;text-align:center}.canvas{flex:1;min-height:0;min-width:0;position:relative;overflow:hidden}.canvas>div{position:absolute;inset:0}.canvas.overlay{cursor:crosshair}.palette{gap:5px;padding:8px 12px;flex-wrap:wrap;border-top:1px solid var(--border);background:#fbfcf9}.tool{font-weight:500;min-height:26px;padding:2px 6px;font-size:11px}.tool[aria-pressed=true]{background:var(--tint);border-color:var(--accent);color:var(--accent)}
.codepanel{background:#192722;color:#e5ece5;border-left:1px solid #26372f}.codepanel .subhead{color:#ecf0ea;background:#23332b;border-bottom:1px solid #37483d}.codepanel .iconbtn{background:transparent;color:#cad6cc;border-color:#526458}.code-name{font:12px 'IBM Plex Mono',ui-monospace,monospace;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.code{overflow:auto;flex:1;padding:13px 0 22px;min-height:0;counter-reset:line;font:12px/1.75 'IBM Plex Mono','Liberation Mono',monospace;tab-size:4}.line{display:flex;width:max-content;min-width:100%;white-space:pre;background:none;border:0;text-align:left;color:#e1e9e0;padding:0 12px 0 0;font:inherit;align-items:baseline;border-left:3px solid transparent}.line .num{position:sticky;left:0;display:inline-block;padding:0 9px 0 7px;min-width:36px;text-align:right;color:#8da095;user-select:none;background:#192722;font-size:10px}.line.match{background:#344d3e;border-left-color:#9ddaac}.line.match .num{background:#344d3e}.line:is(:hover,:focus-visible){background:#2a3d32}.kw{color:#a3cdb9}.str{color:#e7cc96}.literal{color:#bcb2e0}.comment{color:#92a997}
.status{font-size:11px;gap:8px;min-height:30px;border-top:1px solid var(--border);padding:5px 14px;color:#4a5a50;background:#fff}.status:before{content:'';width:7px;height:7px;border-radius:50%;background:var(--accent);flex:none}.status[data-error=true]{color:#903c2c}.status[data-error=true]:before{background:#b6523e}.status .message{min-width:0;overflow-wrap:anywhere}.counts{margin-left:auto;white-space:nowrap;color:#6d786e}
.menu{position:absolute;z-index:10;padding:4px;min-width:150px;max-width:95%;border:1px solid #d9e0d7;border-radius:8px;background:white;color:#213127;box-shadow:0 7px 24px #1d2c2929}.menubtn{justify-content:flex-start;display:flex;width:100%;background:transparent;border:0;white-space:normal;text-align:left}.menubtn:hover{background:var(--tint)}.problem{padding:16px;line-height:1.5}.problem button{margin-top:12px}.error-label{color:#ffd397;font-size:12px}
dialog{border:1px solid #cdd6ce;border-radius:11px;background:#fff;color:#172920;width:min(420px,91vw);box-shadow:0 18px 70px #10231a33;padding:19px;font:14px Inter,system-ui,sans-serif}dialog::backdrop{background:#0c150f50}dialog h2{font-size:17px;line-height:1.3;margin:0 0 14px}dialog p{line-height:1.45;margin:6px 0 12px;color:#536158}label.field{display:grid;gap:6px;margin-bottom:13px;font-size:12px;font-weight:610}label.field input,label.field select,label.field textarea{border:1px solid #c4cec4;border-radius:5px;width:100%;padding:8px;color:#1b2b20;background:white;font:13px/1.5 ui-monospace,monospace}label.field textarea{resize:vertical;min-height:95px}dialog footer{display:flex;justify-content:flex-end;gap:7px;margin-top:14px}
.shell { color: #192822; }
:host([data-webos]) {
  color-scheme: dark;
  --surface: var(--desktop-surface, #252a30);
  --raised: var(--desktop-raised, #353d46);
  --edge: var(--desktop-border, #56616c);
  --ink: var(--desktop-text, #f3f6f8);
  --secondary: var(--desktop-muted, #b9c3cc);
  --selection: #32305a;
  --highlight: #bfbcff;
}
:host([data-webos]) :is(.shell,.board) { color: var(--ink); background: var(--surface); }
:host([data-webos]) .shell { --border: var(--edge); }
:host([data-webos]) :is(.bar,.projectbar,.palette,.status,.menu,dialog) {
  color: var(--ink);
  background: var(--raised);
  border-color: var(--edge);
}
:host([data-webos]) :is(.projectname,.fn-select,.subhead) { color: var(--ink); }
:host([data-webos]) :is(.counts,.slash,dialog p) { color: var(--secondary); }
:host([data-webos]) :is(.btn,.iconbtn,.tool,.switch button, label.field :is(input,select,textarea)) {
  background: var(--surface);
  color: var(--ink);
  border-color: var(--edge);
}
:host([data-webos]) :is(.tag,.tool[aria-pressed=true],.switch button[aria-pressed=true]) {
  background: var(--selection);
  color: var(--highlight);
}
:host([data-webos]) :is(.btn,.iconbtn,.tool,.menubtn):hover { background: #485562; }
:host([data-webos]) .btn.primary { background: #5755ac; border-color: var(--highlight); color: #fff; }
:host([data-webos]) .status[data-error=true] { color: #ffc0b3; }
dialog { max-height: calc(100% - 1rem); overflow: auto; }
@container(max-width:690px){.work{grid-template-columns:1fr}.switch{display:flex;gap:0}.switch button{min-height:25px;border-radius:0;padding:2px 7px}.switch button:first-child{border-radius:4px 0 0 4px}.switch button:last-child{border-radius:0 4px 4px 0;border-left:0}.switch button[aria-pressed=true]{background:var(--tint);color:var(--accent)}.work[data-tab=diagram] .codepanel,.work[data-tab=source] .board{display:none}.bar,.projectbar{padding-left:10px;padding-right:10px}.codepanel{border-left:0}.fn-select{max-width:130px}}
@container(max-width:470px){.bar{gap:5px;flex-wrap:wrap}.bar-group{gap:4px}.bar .btn{padding:3px 6px}.bar-group .btn .ico{display:none}.brand{gap:5px}.tag{font-size:10px}.controls{gap:3px}.projectbar{gap:4px;flex-wrap:wrap}.projectname{max-width:95px}.fn-select{max-width:100px}.counts{display:none}.subhead{height:34px}.brand-mark{width:24px;height:24px}.palette{gap:3px;padding:4px 7px}.status{padding-left:9px}}
.menu { max-height: calc(100% - 8px); overflow: auto; }
@container(max-width:470px) {
  :host([data-webos]) .brand { display: none; }
  .bar { padding-block: 5px; }
  .bar-group { width: 100%; margin: 0; flex-wrap: wrap; }
  .projectbar { padding-block: 4px; }
  .subhead { height: 44px; padding-inline: 8px; }
  :is(.btn,.iconbtn,.tool,.menubtn,.switch button,.projectname,.fn-select) {
    min-height: 38px;
    touch-action: manipulation;
  }
  .iconbtn,.subhead .iconbtn,.split>.iconbtn { width: 38px; min-height: 38px; }
  .palette { max-height: 9rem; overflow: auto; }
}
`;
