import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { getCurrentUser } from "@/lib/session";

const run = promisify(execFile);
const maxFileSize = 10 * 1024 * 1024;

export async function POST(request: Request) {
  if (!await getCurrentUser()) return Response.json({ error: "Authentication required." }, { status: 401 });

  let workbook: FormDataEntryValue | null;
  try {
    workbook = (await request.formData()).get("workbook");
  } catch {
    return Response.json({ error: "Invalid upload body." }, { status: 400 });
  }
  if (!(workbook instanceof File) || !workbook.name.toLowerCase().endsWith(".xls") || workbook.size === 0 || workbook.size > maxFileSize) {
    return Response.json({ error: "Provide one valid .xls workbook up to 10 MB." }, { status: 400 });
  }

  const directory = await mkdtemp(join(tmpdir(), "epms-xls-"));
  const input = join(directory, "source.xls");
  const output = join(directory, "source.xlsx");
  try {
    await writeFile(input, new Uint8Array(await workbook.arrayBuffer()));
    await run("soffice", [
      `-env:UserInstallation=${pathToFileURL(join(directory, "profile")).href}`,
      "--headless",
      "--convert-to",
      "xlsx",
      "--outdir",
      directory,
      input,
    ], { timeout: 120_000 });
    return new Response(await readFile(output), {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    });
  } catch {
    return Response.json({ error: "The legacy workbook could not be converted. Confirm it opens normally in Excel." }, { status: 422 });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
