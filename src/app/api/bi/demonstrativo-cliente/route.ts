import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDemonstrativoCliente } from "@/lib/queries/comercial-analytics";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const idCliente = searchParams.get("idCliente");
  const mesInicio = Number(searchParams.get("mesInicio"));
  const mesFim = Number(searchParams.get("mesFim"));
  const ano = Number(searchParams.get("ano"));

  if (!idCliente || !Number.isFinite(mesInicio) || !Number.isFinite(mesFim) || !Number.isFinite(ano)) {
    return NextResponse.json(
      { error: "missing or invalid params: idCliente, mesInicio, mesFim, ano" },
      { status: 400 },
    );
  }

  try {
    const demo = await getDemonstrativoCliente(idCliente, mesInicio, mesFim, ano);
    return NextResponse.json(demo);
  } catch (error) {
    console.error("[api/bi/demonstrativo-cliente]", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
