import test from 'node:test';
import assert from 'node:assert/strict';
import {fileBridge} from '../runtime/files.mjs';

test('guest projects and exports stay in current workspace Files', async () => {
  const subject = 'guest-tab';
  let session = {public:{kind:'anonymous', sub:subject}};
  const selected = 'Documents/diagram';
  const revision = 'a'.repeat(64);
  const buffer = Uint8Array.of(12, 34);
  const bytes = new Blob([buffer]);
  let wrote = false;
  const context = {owner:subject, valid:()=>session.public.sub===subject, files:{
    async read(path) { assert.equal(path, selected); return {data:bytes, sha256:revision}; },
    async version() { return {sha256:revision}; },
    async write(path,payload,expected) {
      assert.equal(path,selected);
      assert.deepEqual(new Uint8Array(await payload.arrayBuffer()),buffer);
      assert.equal(expected,revision);
      wrote=true;return {sha256:revision};
    }
  }};
  const controller = new AbortController();
  const host = {
    session:()=>session, storage:{
      workspaceOwner:()=>session.public.sub, workspaceFileContext:async()=>context,
      pickWorkspaceFile:async()=>'/'+selected,
      accountFileContext:()=>assert.fail('Guest requested an account file client'),
      pickAccountFile:()=>assert.fail('Guest requested a private picker'),
      signedInSubject:()=>null
    },
    w:{launchContext:{storage:'account',owner:subject,path:selected,sha256:revision}}
  };
  const bridge = fileBridge(host,controller.signal);
  assert.equal(bridge.location,'Temporary Files');
  assert.deepEqual(bridge.launch(), {path:selected,sha256:revision,restore:false});
  assert.equal(await bridge.pick([]),selected);
  assert.deepEqual((await bridge.read(selected,revision)).bytes,buffer);
  await assert.rejects(bridge.read(selected,'b'.repeat(64)), /changed/);
  await bridge.write(selected,buffer,revision);
  assert.equal(wrote,true);
  session={public:{kind:'account',sub:'another-user'}};
  await assert.rejects(bridge.read(selected,revision), /no longer active/);
});

test('a standalone studio keeps its device file actions', () => {
  const bridge=fileBridge({},new AbortController().signal);
  assert.equal(bridge.hosted,false);
  assert.equal(bridge.location,'Device files');
});
