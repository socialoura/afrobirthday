// Isolated regression tests: no database, Telegram, storage or TTS is contacted.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createDecipheriv, createHash } from 'node:crypto';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const orderId = '11111111-1111-4111-8111-111111111111';
const jobId = '22222222-2222-4222-8222-222222222222';
const musicLink = 'https://open.spotify.com/track/4Fb44L52QsQtHT0mL9WhtE';
const media = 'https://media.afrobirthday.com';
process.env.ADMIN_TOKEN_SECRET = 'test-only-not-a-real-secret-123456789';
process.env.MEDIA_UPLOAD_SECRET = 'test-only-media-secret-12345678901234';
process.env.TELEGRAM_BOT_TOKEN = 'TEST_BOT';
process.env.TELEGRAM_CHAT_ID = '123';
delete process.env.DATABASE_URL;
globalThis.testOrder = { id: orderId, status: 'paid', music_option: 'custom', music_link: musicLink, music_file_url: null, downloaded_music_url: null, email: 'test@example.invalid', message: null, created_at: new Date().toISOString() };
globalThis.persisted = [];
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === '@/lib/db') return { shortCircuit:true, url:'data:text/javascript,'+encodeURIComponent('export const getOrderById=async()=>globalThis.testOrder; export const setOrderMedia=async(id,m)=>{globalThis.persisted.push(m)};') };
  if (specifier === '@/lib/voiceover') return { shortCircuit:true, url:'data:text/javascript,'+encodeURIComponent('export const describeVoiceoverFailure=r=>r; export const generateVoiceoverIfNonEnglish=async()=>({ok:false,reason:"empty-message"});') };
  if (specifier.startsWith('@/')) return nextResolve(new URL('src/'+specifier.slice(2)+'.ts', root).href,context);
  if (specifier === 'next/server') return nextResolve('next/server.js',context);
  return nextResolve(specifier,context);
}, load(url,context,nextLoad) {
  if(url.startsWith('file:') && url.endsWith('.ts')) return {shortCircuit:true,format:'module',source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText};
  return nextLoad(url,context);
}});
let requests = [], telegramFails = false;
globalThis.fetch = async (url, options={}) => {
  const u = String(url); requests.push({url:u,...options});
  if (u.startsWith(media+'/_upload/')) return new Response('{}',{status:200});
  if (u.startsWith(media+'/orders/music/')) return new Response(null,{status:200,headers:{'content-type':'audio/mpeg','content-length':'2500000'}});
  if (u.startsWith('https://api.telegram.org/')) {
    if (telegramFails) return Response.json({ok:false,description:'simulated rejection'},{status:400});
    return Response.json({ok:true,result:{message_id:42,from:{username:'test_commands_bot'},chat:{id:123}}});
  }
  throw new Error('Unexpected network call: '+u);
};
const { queueMusicDownload, signMusicResult, encryptMusicJob } = await import('../src/lib/musicDownloader.ts');
const { POST } = await import('../src/app/api/internal/music-result/route.ts');
const { notifyOrderPaid } = await import('../src/lib/discordWebhook.ts');
const { sendTelegramAudio } = await import('../src/lib/telegramBot.ts');
let count=0;
async function test(name,fn){ await fn(); count++; console.log('PASS',name); }
await test('encrypted queue, no paid downloader and no cleartext source',async()=>{
 requests=[]; const r=await queueMusicDownload(musicLink,orderId); assert.equal(r.queued,true); assert.equal(requests.length,1); assert.match(requests[0].url,/\/orders\/music-jobs\/[\da-f-]+\.json\?/);
 const encoded=await requests[0].body.text(); assert.ok(!encoded.includes('spotify')); const e=JSON.parse(encoded);
 const decipher=createDecipheriv('aes-256-gcm',createHash('sha256').update('afrobirthday-music-jobs\n'+process.env.ADMIN_TOKEN_SECRET).digest(),Buffer.from(e.nonce,'base64')); decipher.setAuthTag(Buffer.from(e.tag,'base64'));
 const job=JSON.parse(Buffer.concat([decipher.update(Buffer.from(e.ciphertext,'base64')),decipher.final()])); assert.equal(job.musicLink,musicLink); assert.equal(job.orderId,orderId);
});
await test('reject URLs pointing elsewhere, credentials, ports and bad order IDs',async()=>{
 for (const url of ['https://youtube.com.evil.invalid/watch?v=x','http://127.0.0.1/a','https://open.spotify.com:777/a','https://me:pass@youtube.com/watch?v=x']) assert.equal((await queueMusicDownload(url,orderId)).queued,false);
 assert.equal((await queueMusicDownload(musicLink,'invalid')).queued,false);
});
await test('disabled downloads report failure explicitly',async()=>{ process.env.DISABLE_MUSIC_AUTO_DOWNLOAD='true'; assert.equal((await queueMusicDownload(musicLink,orderId)).queued,false); delete process.env.DISABLE_MUSIC_AUTO_DOWNLOAD; });
const job={jobId,orderId,musicLink,createdAt:Date.now()};
function callback(result='ready',timestamp=Date.now(),alter=false){ const body=JSON.stringify({...job,result}); return new Request('https://www.afrobirthday.com/api/internal/music-result',{method:'POST',body,headers:{'content-type':'application/json','x-music-timestamp':String(timestamp),'x-music-signature':alter?'bad':signMusicResult(body,String(timestamp))}}); }
await test('callback rejects absent, bad and expired signatures',async()=>{
 assert.equal((await POST(new Request('https://example.invalid',{method:'POST',body:'{}'}))).status,401);
 assert.equal((await POST(callback('ready',Date.now(),true))).status,401);
 assert.equal((await POST(callback('ready',Date.now()-700000))).status,401);
});
await test('ready MP3 persisted AND sent by actual notification function',async()=>{
 requests=[]; globalThis.persisted=[]; const res=await POST(callback()); assert.equal(res.status,200); const receipt=await res.json(); assert.equal(receipt.messageId,42); assert.equal(receipt.botUsername,'test_commands_bot'); assert.equal(globalThis.persisted[0].downloadedMusicUrl,`${media}/orders/music/${orderId}-${jobId}.mp3`);
 const audio=requests.filter(r=>r.url.endsWith('/sendAudio')); assert.equal(audio.length,1); assert.equal(JSON.parse(audio[0].body).audio,globalThis.persisted[0].downloadedMusicUrl);
});
await test('callback cannot deliver to unpaid order or stale source',async()=>{
 const saved=globalThis.testOrder; globalThis.testOrder={...saved,status:'pending'}; assert.equal((await POST(callback())).status,409); globalThis.testOrder={...saved,music_link:'https://youtu.be/other'}; assert.equal((await POST(callback())).status,409); globalThis.testOrder=saved;
});
await test('failed download produces actionable missing-MP3 alert',async()=>{
 requests=[]; assert.equal((await POST(callback('failed'))).status,200); assert.ok(requests.some(r=>r.url.endsWith('/sendMessage')&&JSON.parse(r.body).text.includes('MP3 MANQUANT')));
});
await test('Telegram rejection is a failure, allowing worker retry',async()=>{
 telegramFails=true; assert.equal((await sendTelegramAudio('https://example.invalid/audio.mp3','test')).ok,false); assert.equal((await POST(callback())).status,503); telegramFails=false;
});
for(const scenario of ['upload','saved','link','both','choice']) await test('paid notification: '+scenario,async()=>{
 requests=[]; const order={...globalThis.testOrder};
 if(scenario==='upload'||scenario==='both') order.music_file_url=media+'/customer.mp3';
 if(scenario==='upload'||scenario==='choice') order.music_link=null;
 if(scenario==='saved') order.downloaded_music_url=media+'/saved.mp3';
 if(scenario==='choice') order.music_option='default';
 await notifyOrderPaid({order,provider:'Stripe',amountLabel:'$39'});
 const uploads=requests.filter(r=>r.url.includes('/_upload/')); assert.equal(uploads.length,scenario==='link'?1:0);
 const audios=requests.filter(r=>r.url.endsWith('/sendAudio')).map(r=>JSON.parse(r.body).audio);
 assert.deepEqual(audios,scenario==='upload'||scenario==='both'?[media+'/customer.mp3']:scenario==='saved'?[media+'/saved.mp3']:[]);
 if(scenario==='link') assert.ok(requests.some(r=>r.url.endsWith('/sendMessage')&&JSON.parse(r.body).text.includes('MP3 en cours')));
});
await test('dedicated worker key overrides admin key for both encryption and signatures', async()=>{
 const dedicated='test-only-worker-key-12345678901234567890'; process.env.MUSIC_WORKER_SECRET=dedicated;
 try {
  const encoded=JSON.parse(encryptMusicJob(job));
  const decipher=createDecipheriv('aes-256-gcm',createHash('sha256').update('afrobirthday-music-jobs\n'+dedicated).digest(),Buffer.from(encoded.nonce,'base64')); decipher.setAuthTag(Buffer.from(encoded.tag,'base64'));
  assert.equal(JSON.parse(Buffer.concat([decipher.update(Buffer.from(encoded.ciphertext,'base64')),decipher.final()])).jobId,jobId);
  assert.equal((await POST(callback())).status,200);
 } finally { delete process.env.MUSIC_WORKER_SECRET; }
});
console.log(`${count} isolated music checks passed`);
