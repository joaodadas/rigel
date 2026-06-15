// Testa streamEntityPages: loop página→upsert→deadline (lógica pura via callbacks).
// USO: npx tsx --env-file=.env.local scripts/test-stream-entity-pages.ts
import { streamEntityPages } from "../src/lib/sync/incremental";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}
let idSeq = 0;
function page(n: number, idField = "id_pedido"): Record<string, unknown>[] {
  return Array.from({ length: n }, () => ({ [idField]: ++idSeq }));
}

async function main() {
  // 1. Completo: 250 + 250 + 100 => para na página curta, complete=true
  {
    const pages = [page(250), page(250), page(100)];
    const upserts: number[] = [];
    const res = await streamEntityPages({
      entityName: "pedidos", pk: "id_pedido", deadlineAt: Date.now() + 60_000,
      fetchPage: async (off) => pages[off / 250] ?? [],
      upsertBatch: async (rows) => { upserts.push(rows.length); },
    });
    assert(res.complete === true, "deveria completar");
    assert(res.pagesFetched === 3, `esperado 3 páginas, veio ${res.pagesFetched}`);
    assert(res.synced === 600, `esperado synced=600, veio ${res.synced}`);
    assert(upserts.length === 3, `esperado 3 upserts, veio ${upserts.length}`);
  }

  // 2. Deadline: páginas cheias infinitas, relógio cruza o deadline na 3ª checagem
  {
    let calls = 0;
    const clock = [0, 0, 2000]; // now() é chamado no topo de cada iteração
    const upserts: number[] = [];
    const res = await streamEntityPages({
      entityName: "clientes", pk: "id_cliente", deadlineAt: 1000,
      now: () => clock[calls++],
      fetchPage: async () => page(250, "id_cliente"),
      upsertBatch: async (rows) => { upserts.push(rows.length); },
    });
    assert(res.complete === false, "deadline deveria deixar complete=false");
    assert(res.pagesFetched === 2, `esperado 2 páginas antes do deadline, veio ${res.pagesFetched}`);
    assert(upserts.length === 2, `esperado 2 upserts parciais, veio ${upserts.length}`);
  }

  // 3. Vazio: primeira página vazia => complete=true, sem upsert
  {
    const upserts: number[] = [];
    const res = await streamEntityPages({
      entityName: "vendedores", pk: "id_vendedor", deadlineAt: Date.now() + 60_000,
      fetchPage: async () => [],
      upsertBatch: async (rows) => { upserts.push(rows.length); },
    });
    assert(res.complete === true, "vazio deveria completar");
    assert(res.synced === 0 && upserts.length === 0, "vazio não deveria upsertar");
  }

  // 4. Dedup por PK dentro da página
  {
    let received = -1;
    const dup = [{ id_cliente: 1 }, { id_cliente: 1 }, { id_cliente: 2 }];
    await streamEntityPages({
      entityName: "clientes", pk: "id_cliente", deadlineAt: Date.now() + 60_000,
      fetchPage: async (off) => (off === 0 ? dup : []),
      upsertBatch: async (rows) => { received = rows.length; },
    });
    assert(received === 2, `dedup deveria deixar 2 linhas, veio ${received}`);
  }

  // 5. fetchPage que lança (retry esgotado) PROPAGA — nunca vira "complete"
  {
    let threw = false;
    try {
      await streamEntityPages({
        entityName: "pedidos", pk: "id_pedido", deadlineAt: Date.now() + 60_000,
        fetchPage: async () => { throw new Error("VHSys [..] GET /pedidos failed: code 404"); },
        upsertBatch: async () => {},
      });
    } catch (e) {
      threw = true;
      assert(/404/.test(String(e)), `erro deveria propagar, veio ${String(e)}`);
    }
    assert(threw, "fetchPage que lança deveria propagar (não completar silenciosamente)");
  }

  console.log("PASS: streamEntityPages");
}

main().catch((e) => { console.error("FAIL:", e instanceof Error ? e.message : e); process.exit(1); });
