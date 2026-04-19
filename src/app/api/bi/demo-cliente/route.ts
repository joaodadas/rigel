import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDemonstrativoCliente } from "@/lib/queries/comercial-analytics";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clienteId = Number(searchParams.get("clienteId"));
  const mesInicio = Number(searchParams.get("mesInicio") || "1");
  const mesFim = Number(searchParams.get("mesFim") || String(new Date().getMonth() + 1));
  const ano = Number(searchParams.get("ano") || String(new Date().getFullYear()));

  if (!clienteId) {
    return NextResponse.json({ error: "clienteId required" }, { status: 400 });
  }

  try {
    const data = await getDemonstrativoCliente(clienteId, mesInicio, mesFim, ano);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[api/bi/demo-cliente] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
