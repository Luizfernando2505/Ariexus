// Usado pelo CI e pelo deploy para confirmar que o servidor do app está de pé.
export function GET() {
  return Response.json({ status: "ok" });
}
