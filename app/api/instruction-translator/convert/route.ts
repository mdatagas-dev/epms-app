import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { getCurrentUser } from "@/lib/session";

const run = promisify(execFile);
const maxFileSize = 250 * 1024 * 1024;
const formats = {
  doc: { output: "docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  xls: { output: "xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
} as const;

export async function POST(request: Request) {
  if (!await getCurrentUser()) return Response.json({ error: "Authentication required." }, { status: 401 });

  let workbook: FormDataEntryValue | null;
  try {
    workbook = (await request.formData()).get("workbook");
  } catch {
    return Response.json({ error: "Invalid upload body." }, { status: 400 });
  }
  const extension = workbook instanceof File ? workbook.name.toLowerCase().match(/\.(doc|xls)$/)?.[1] as keyof typeof formats | undefined : undefined;
  if (!(workbook instanceof File) || !extension || workbook.size === 0 || workbook.size > maxFileSize) {
    return Response.json({ error: "Provide one valid legacy DOC or XLS file up to 250 MB." }, { status: 400 });
  }

  const directory = await mkdtemp(join(tmpdir(), "epms-xls-"));
  const format = formats[extension];
  const input = join(directory, `source.${extension}`);
  const output = join(directory, `source.${format.output}`);
  try {
    await writeFile(input, new Uint8Array(await workbook.arrayBuffer()));
    await run("soffice", [
      `-env:UserInstallation=${pathToFileURL(join(directory, "profile")).href}`,
      "--headless",
      "--convert-to",
      format.output,
      "--outdir",
      directory,
      input,
    ], { timeout: 120_000 });
    return new Response(await readFile(output), {
      headers: { "Content-Type": format.contentType },
    });
  } catch {
    return Response.json({ error: "The legacy file could not be converted. Confirm it opens normally in Microsoft Office." }, { status: 422 });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
