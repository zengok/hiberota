import test from "node:test";
import assert from "node:assert/strict";
import { extractHibePortaliArchiveItems } from "../server/scrapers/hibePortali.mjs";

test("extracts open cascade calls from HibePortali archive cards", () => {
  const html = `
    <article>
      <h2><a href="https://hibeportali.com/kademeli-cagrilar/sample-open-call/">Sample Open Call</a></h2>
      <div><span>Son Başvuru: <strong>30 Haz 2099</strong></span></div>
      <div><span>Bütçe: <strong>0,6 Milyon €</strong></span></div>
      <div><span>Kademeli Çağrılar</span><span>Yapay Zeka ve Büyük Veri</span><span>KOBİ'ler</span></div>
      <p>Sample open call summary for SMEs and research institutions.</p>
    </article>
    <article>
      <h2><a href="https://hibeportali.com/kademeli-cagrilar/closed-call/">Closed Call</a></h2>
      <div><span>Son Başvuru: <strong>10 Haz 2020</strong></span></div>
      <p>Closed call summary.</p>
    </article>
  `;

  const calls = extractHibePortaliArchiveItems(html);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].id, "hibeportali-sample-open-call");
  assert.equal(calls[0].title, "Sample Open Call");
  assert.equal(calls[0].deadline, "2099-06-30T00:00:00.000Z");
  assert.equal(calls[0].support, "Bütçe: 0,6 Milyon €");
  assert.deepEqual(calls[0].categories, ["Yapay Zeka ve Büyük Veri", "KOBİ'ler"]);
  assert.equal(calls[0].requiresManualReview, true);
});
