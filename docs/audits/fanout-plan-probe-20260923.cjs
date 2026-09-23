// Read-only actual-source counterexample; run from C:/Users/bradp/dev/fanout.
// No credentials, network, product edits or real database writes.
const fs = require('fs'), vm = require('vm'), ts = require('typescript'), assert = require('assert');
const effects = [], queries = [];
const post = { id: 'post-B', profile_id: 'B', content: 'B-private-content', media_urls: null };
const db = { from(table) {
  const filters = {}; queries.push({ table, filters });
  const q = {
    select() { return q }, eq(k, v) { filters[k] = v; return q }, in(k,v) { filters[k]=v;return q },
    single() {
      const data = table === 'posts'
        ? (Object.entries(filters).every(([k,v]) => post[k] === v) ? post : null)
        : { webhook_url: null };
      return Promise.resolve({ data, error: null });
    },
    update(v) { effects.push({ table, write: v }); return q },
    upsert(v) { effects.push({ table, write: v }); return q },
    insert(v) { effects.push({ table, write: v }); return q },
    then(resolve) { return resolve({ data: table === 'oauth_tokens'
      ? [{ platform: 'facebook', access_token: 'token-' + filters.profile_id }] : [], error: null }) }
  }; return q;
} };
class FakeDistributor { async post(payload, token) {
  effects.push({ provider: true, payload, token }); return { success: true, platformPostId: 'fake' };
} }
function load(path, mocks) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, { module, exports: module.exports, require(n) {
    if (mocks[n]) return mocks[n];
    if (n.startsWith('@/distributors/')) return new Proxy({ RateLimitError: class extends Error {} }, {
      get(t,k) { return t[k] || FakeDistributor }
    });
    throw Error(n);
  }, console, Date, Promise, fetch() { throw Error('LIVE CALL BLOCKED') } });
  return module.exports;
}
(async () => {
  const lib = load('src/lib/fan-out.ts', {
    './supabase': { supabase: db }, './crypto': { decryptToken: async t => t }
  });
  await lib.fanOut('post-B', ['facebook'], 'A');
  const call = effects.find(x => x.provider);
  assert.equal(call?.token, 'token-A'); assert.equal(call?.payload.content, 'B-private-content');
  console.log('FALSIFIED worker binding: post-B content dispatched with token-A; mocked provider calls=' + effects.filter(x=>x.provider).length);
  const source = fs.readFileSync('src/app/api/v1/post/route.ts','utf8');
  const schemaText = source.slice(source.indexOf('const PostSchema'), source.indexOf('export async function'));
  const ctx = { z: require('zod').z };
  vm.runInNewContext(schemaText + ';globalThis.schema=PostSchema', ctx);
  for (const [label,data] of [
    ['unknown platform', {post:'x', platforms:['bogus'], profileId:'A'}],
    ['281 Twitter chars', {post:'x'.repeat(281), platforms:['twitter'], profileId:'A'}],
    ['Instagram without media', {post:'x', platforms:['instagram'], profileId:'A'}]
  ]) { assert(ctx.schema.safeParse(data).success); console.log('SCHEMA ACCEPTS ' + label) }
})().catch(e => { console.error(e); process.exit(1) });
