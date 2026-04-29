// Reproduz o pipeline do POST /api/dre/upload usando service role,
// pulando apenas o gate de autenticação. Valida: parse → upload Storage →
// DELETE+INSERT dre_lancamentos → UPDATE dre_uploads (sucesso).
//
// Uso: npx tsx --env-file=.env.local scripts/test-dre-upload-flow.ts "C:/Users/misae/.../DRE 2026 Rigel.xlsx"

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { parseDRE } from "../src/lib/dre/parser";

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Uso: npx tsx scripts/test-dre-upload-flow.ts <caminho-da-planilha.xlsx>");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar setados.");
    process.exit(1);
  }

  const BUCKET = "dre-uploads";
  const supabase = createClient(url, key);

  const fullPath = resolve(arg);
  console.log(`Lendo: ${fullPath}\n`);

  const buffer = readFileSync(fullPath);
  const fileName = fullPath.split(/[/\\]/).pop()!;

  // 1. Parse
  console.log("1. Parseando…");
  const parsed = parseDRE(buffer);
  console.log(`   ano=${parsed.anoReferencia} meses=${parsed.mesesProcessados.join(",")}`);
  console.log(`   lancamentos=${parsed.lancamentos.length} warnings=${parsed.warnings.length}`);

  if (parsed.mesesProcessados.length === 0) {
    console.error("Nenhum mês com dados.");
    process.exit(1);
  }

  // 2. INSERT dre_uploads (processando)
  console.log("\n2. Registrando upload (status=processando)…");
  const uploadId = randomUUID();
  const storagePath = `${parsed.anoReferencia}/${uploadId}.xlsx`;

  // Pega um usuario admin pra preencher usuario_id (a coluna é NOT NULL)
  const { data: usuariosAdmin } = await supabase
    .from("user")
    .select("id, email")
    .eq("role", "admin")
    .limit(1);

  const usuarioId = usuariosAdmin?.[0]?.id ?? "test-script";
  console.log(`   upload_id=${uploadId}`);
  console.log(`   usuario_id=${usuarioId} (${usuariosAdmin?.[0]?.email ?? "fallback"})`);

  const { error: insertErr } = await supabase.from("dre_uploads").insert({
    id: uploadId,
    nome_arquivo: fileName,
    storage_path: storagePath,
    tamanho_bytes: buffer.byteLength,
    ano_referencia: parsed.anoReferencia,
    meses_processados: [],
    usuario_id: usuarioId,
    status: "processando",
  });

  if (insertErr) {
    console.error("FALHA insert dre_uploads:", insertErr);
    process.exit(1);
  }

  // 3. Upload Storage
  console.log("\n3. Subindo arquivo no Storage…");
  const { error: storageErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: false,
    });

  if (storageErr) {
    console.error("FALHA storage upload:", storageErr);
    await supabase
      .from("dre_uploads")
      .update({ status: "erro", erros: { fatal: `storage: ${storageErr.message}` } })
      .eq("id", uploadId);
    process.exit(1);
  }
  console.log(`   ok → ${storagePath}`);

  // 4. DELETE+INSERT dre_lancamentos
  console.log("\n4. DELETE+INSERT dre_lancamentos…");
  const periodos = parsed.mesesProcessados.map(
    (m) => `${parsed.anoReferencia}-${String(m).padStart(2, "0")}-01`,
  );

  const { error: delErr, count: deletedCount } = await supabase
    .from("dre_lancamentos")
    .delete({ count: "exact" })
    .in("periodo", periodos);

  if (delErr) {
    console.error("FALHA delete:", delErr);
    process.exit(1);
  }
  console.log(`   deletados: ${deletedCount ?? 0}`);

  const rows = parsed.lancamentos.map((l) => ({
    periodo: l.periodo,
    empresa: l.empresa,
    regime_tributario: l.regime_tributario,
    categoria: l.categoria,
    sub_categoria: l.sub_categoria,
    descricao: l.descricao,
    valor: l.valor,
    pct_sobre_faturamento: l.pct_sobre_faturamento,
    upload_id: uploadId,
  }));

  const { error: insLancErr } = await supabase.from("dre_lancamentos").insert(rows);

  if (insLancErr) {
    console.error("FALHA insert lancamentos:", insLancErr);
    await supabase
      .from("dre_uploads")
      .update({ status: "erro", erros: { fatal: `insert: ${insLancErr.message}` } })
      .eq("id", uploadId);
    process.exit(1);
  }
  console.log(`   inseridos: ${rows.length}`);

  // 5. UPDATE dre_uploads (sucesso)
  console.log("\n5. Marcando upload como sucesso…");
  await supabase
    .from("dre_uploads")
    .update({
      status: "sucesso",
      meses_processados: parsed.mesesProcessados,
      erros: parsed.warnings.length > 0 ? { warnings: parsed.warnings } : null,
    })
    .eq("id", uploadId);

  // 6. Validações finais
  console.log("\n6. Validações pós-insert…");

  const { count: totalLancamentos } = await supabase
    .from("dre_lancamentos")
    .select("*", { count: "exact", head: true });
  console.log(`   total dre_lancamentos: ${totalLancamentos}`);

  const { data: rl } = await supabase
    .from("dre_lancamentos")
    .select("valor")
    .eq("periodo", "2026-01-01")
    .eq("empresa", "consolidado")
    .eq("sub_categoria", "receita_liquida")
    .single();
  console.log(`   receita_liquida 2026-01 consolidado: R$ ${rl?.valor ?? "—"} (esperado: 3298053.80)`);

  const { data: ult } = await supabase
    .from("dre_uploads")
    .select("id, status, ano_referencia, meses_processados, erros")
    .eq("id", uploadId)
    .single();
  console.log(`   upload status=${ult?.status} meses=${ult?.meses_processados?.length ?? 0}`);

  console.log("\n✓ Pipeline completo (parser + storage + DB) OK.");
}

main().catch((err) => {
  console.error("ERRO FATAL:", err);
  process.exit(1);
});
