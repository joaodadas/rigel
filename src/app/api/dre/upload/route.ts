import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSession } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/client";
import { parseDRE } from "@/lib/dre/parser";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 50 * 1024 * 1024; // 50MB
const BUCKET = "dre-uploads";

export async function POST(req: NextRequest) {
  // 1. Auth + role check
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const role = session.user.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Apenas admin pode fazer upload" }, { status: 403 });
  }

  // 2. Validação de arquivo
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Body inválido (esperado multipart/form-data)" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Campo 'file' ausente" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "Apenas arquivos .xlsx são aceitos" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `Arquivo excede ${MAX_BYTES / 1024 / 1024}MB` }, { status: 400 });
  }

  const supabase = createSupabaseServer();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 3. Pré-parse mínimo para descobrir o ano (precisamos antes do INSERT em dre_uploads)
  let parsed: ReturnType<typeof parseDRE>;
  try {
    parsed = parseDRE(buffer);
  } catch (e) {
    return NextResponse.json({ error: `Falha ao parsear: ${(e as Error).message}` }, { status: 400 });
  }

  if (parsed.mesesProcessados.length === 0) {
    return NextResponse.json(
      { error: "Planilha não contém nenhum mês com dados preenchidos" },
      { status: 400 },
    );
  }

  // 4. Cria upload com status=processando
  const uploadId = randomUUID();
  const storagePath = `${parsed.anoReferencia}/${uploadId}.xlsx`;

  const { error: insertErr } = await supabase.from("dre_uploads").insert({
    id: uploadId,
    nome_arquivo: file.name,
    storage_path: storagePath,
    tamanho_bytes: file.size,
    ano_referencia: parsed.anoReferencia,
    meses_processados: [],
    usuario_id: session.user.id,
    status: "processando",
  });

  if (insertErr) {
    console.error("[dre/upload] insert dre_uploads", insertErr);
    return NextResponse.json({ error: "Falha ao registrar upload" }, { status: 500 });
  }

  // 5. Sobe arquivo no Storage
  const { error: storageErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: false,
    });

  if (storageErr) {
    await supabase
      .from("dre_uploads")
      .update({ status: "erro", erros: { fatal: `storage: ${storageErr.message}` } })
      .eq("id", uploadId);
    return NextResponse.json({ error: `Falha no upload: ${storageErr.message}` }, { status: 500 });
  }

  // 6. Persistência transacional: DELETE + INSERT por mês
  const periodos = parsed.mesesProcessados.map(
    (m) => `${parsed.anoReferencia}-${String(m).padStart(2, "0")}-01`,
  );

  const { error: delErr } = await supabase
    .from("dre_lancamentos")
    .delete()
    .in("periodo", periodos);

  if (delErr) {
    await supabase
      .from("dre_uploads")
      .update({ status: "erro", erros: { fatal: `delete: ${delErr.message}` } })
      .eq("id", uploadId);
    return NextResponse.json({ error: `Falha ao limpar dados antigos: ${delErr.message}` }, { status: 500 });
  }

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
    await supabase
      .from("dre_uploads")
      .update({ status: "erro", erros: { fatal: `insert lancamentos: ${insLancErr.message}` } })
      .eq("id", uploadId);
    return NextResponse.json({ error: `Falha ao gravar lançamentos: ${insLancErr.message}` }, { status: 500 });
  }

  // 7. Marca upload como sucesso
  await supabase
    .from("dre_uploads")
    .update({
      status: "sucesso",
      meses_processados: parsed.mesesProcessados,
      erros: parsed.warnings.length > 0 ? { warnings: parsed.warnings } : null,
    })
    .eq("id", uploadId);

  return NextResponse.json({
    upload_id: uploadId,
    ano: parsed.anoReferencia,
    meses_processados: parsed.mesesProcessados,
    total_lancamentos: rows.length,
    warnings: parsed.warnings,
  });
}
