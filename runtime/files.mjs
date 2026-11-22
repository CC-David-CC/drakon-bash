const sha = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
export function fileBridge(host, signal) {
  const session = host?.session?.();
  const storage = host?.storage;
  const workspace = typeof storage?.workspaceFileContext === 'function';
  const owner = workspace ? storage.workspaceOwner : storage?.signedInSubject;
  const openContext = workspace ? storage.workspaceFileContext : storage?.accountFileContext;
  const pickFile = workspace ? storage.pickWorkspaceFile : storage?.pickAccountFile;
  const subject = owner?.();
  const hosted = !!subject && typeof openContext === 'function';
  function live(ctx) {
    if (signal.aborted) throw new DOMException('Window closed.', 'AbortError');
    if (
      hosted &&
      (host.session?.() !== session ||
        owner?.() !== subject ||
        (ctx && (!ctx.valid() || ctx.owner !== subject)))
    )
      throw Error('This account window is no longer active.');
  }
  async function context() {
    live();
    const ctx = await openContext();
    live(ctx);
    return ctx;
  }
  function checkPath(path) {
    if (
      typeof path !== 'string' ||
      path.length > 2048 ||
      /[\\\u0000-\u001f]/.test(path) ||
      path.split('/').some((x) => !x || x === '.' || x === '..')
    )
      throw Error('Choose a file in My files.');
    return path;
  }
  return {
    hosted,
    location: hosted ? (session?.public?.kind === 'anonymous' ? 'Temporary Files' : 'Account Files') : 'Device files',
    live,
    launch() {
      const f = host?.w?.launchContext;
      if (!f) return null;
      if (f.storage !== 'account' || f.owner !== subject || (!f.restore && !sha(f.sha256)))
        throw Error('Invalid account file launch.');
      return { path: checkPath(f.path), sha256: f.sha256, restore: f.restore === true };
    },
    async pick(extensions) {
      live();
      const p = await pickFile({ extensions, signal });
      live();
      return p == null ? null : checkPath(p.slice(1));
    },
    async destination(suggested, suffix) {
      live();
      const folder = await pickFile({ foldersOnly: true, signal });
      live();
      if (folder == null) return null;
      const answer = await host.ui.prompt('File name', {
        title: 'Save to Files',
        value: suggested,
        confirmLabel: 'Save',
        signal,
      });
      live();
      if (answer == null) return null;
      const leaf = answer.trim();
      if (!leaf || leaf.includes('/')) throw Error('Enter one file name.');
      return checkPath(
        (folder === '/' ? '' : folder.slice(1) + '/') +
          leaf +
          (leaf.toLowerCase().endsWith(suffix) ? '' : suffix),
      );
    },
    async read(path, expected) {
      checkPath(path);
      const ctx = await context(),
        r = await ctx.files.read(path, { signal });
      live(ctx);
      if (!sha(r.sha256) || (expected && expected !== r.sha256))
        throw Error('This file changed. Reopen the current revision in Files.');
      const bytes = r.data instanceof Blob ? new Uint8Array(await r.data.arrayBuffer()) : r.data;
      live(ctx);
      if (!(bytes instanceof Uint8Array)) throw Error('Invalid account file data.');
      return { bytes, sha256: r.sha256, path };
    },
    async version(path) {
      checkPath(path);
      const ctx = await context();
      try {
        const file = await ctx.files.version(path);
        live(ctx);
        if (!sha(file?.sha256)) throw Error('Files did not confirm the current file revision.');
        return file.sha256;
      } catch (e) {
        live(ctx);
        if (e?.status === 404) return null;
        throw e;
      }
    },
    async write(path, bytes, expected) {
      checkPath(path);
      const ctx = await context();
      const r = await ctx.files.write(path, new Blob([bytes]), expected, { signal });
      live(ctx);
      if (!sha(r?.sha256))
        throw Error('Files did not confirm this revision. Reopen Files before retrying.');
      return { path, sha256: r.sha256 };
    },
    bind(resource) {
      live();
      if (hosted && host.w && host.desktop?.updateAccountFileBinding)
        host.desktop.updateAccountFileBinding(host.w, {
          owner: subject,
          path: resource?.path ?? null,
          sha256: resource?.sha256 ?? null,
        });
    },
  };
}
export function downloadFile(doc, bytes, name, mime) {
  const a = doc.createElement('a'),
    url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  a.href = url;
  a.download = name;
  doc.body.append(a);
  try {
    a.click();
  } finally {
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
}
