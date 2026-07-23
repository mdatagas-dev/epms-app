"use client";

import { useState } from "react";

import { buildCompanyTemplate, extractCompanyInstruction, type TemplateMetadata, type TemplateStep } from "@/lib/company-template";
import { buildTranslatedDocument, extractDocumentBlocks, extractDocumentPhrases } from "@/lib/docx-translator";
import { buildTranslatedWorkbook, extractWorkbookPhrases } from "@/lib/xlsx-translator";

const maxFileSize = 250 * 1024 * 1024;
const translationBatchSize = 10;
const translationConcurrency = 3;
const companyTemplateUrl = "/templates/company-work-instruction.xlsx";

type Phrase = { source: string; translation: string };
type BusyState = "converting" | "extracting" | "translating" | "downloading" | "preparing-template" | "building-template" | null;
type TargetLanguage = "english" | "indonesian";
type TranslationMode = TargetLanguage | "production-id";
type StructuredStep = { title: string; instruction: string; keyPoints: string[]; startBlock: number; endBlock: number };

export function InstructionTranslator({ ninerouterConfigured }: { ninerouterConfigured: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [templateMetadata, setTemplateMetadata] = useState<TemplateMetadata | null>(null);
  const [templateSteps, setTemplateSteps] = useState<TemplateStep[]>([]);
  const [targetLanguage, setTargetLanguage] = useState<TargetLanguage>("english");
  const [busy, setBusy] = useState<BusyState>(null);
  const [error, setError] = useState("");

  const completed = phrases.filter((phrase) => phrase.translation.trim()).length;
  const missing = phrases.length - completed;
  const targetLabel = targetLanguage === "english" ? "English" : "Bahasa Indonesia";
  const isWord = file?.name.toLowerCase().endsWith(".docx") ?? false;

  async function selectFile(nextFile?: File) {
    setError("");
    setFile(null);
    setPhrases([]);
    setTemplateMetadata(null);
    setTemplateSteps([]);
    if (!nextFile) return;
    if (!/\.(?:docx?|xlsx?)$/i.test(nextFile.name)) return setError("Choose a DOC, DOCX, XLS, or XLSX file. Macro-enabled files are not supported.");
    if (nextFile.size > maxFileSize) return setError("The file exceeds the 250 MB upload limit.");

    const legacyExtension = nextFile.name.toLowerCase().match(/\.(doc|xls)$/)?.[1];
    setBusy(legacyExtension ? "converting" : "extracting");
    try {
      let readableFile = nextFile;
      if (legacyExtension) {
        const formData = new FormData();
        formData.append("workbook", nextFile);
        const response = await fetch("/api/instruction-translator/convert", { method: "POST", body: formData });
        if (!response.ok) {
          const result = await response.json() as { error?: string };
          throw new Error(result.error ?? "The legacy file could not be converted.");
        }
        const word = legacyExtension === "doc";
        readableFile = new File([await response.blob()], nextFile.name.replace(/\.(doc|xls)$/i, word ? ".docx" : ".xlsx"), { type: word ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        setBusy("extracting");
      }
      const buffer = await readableFile.arrayBuffer();
      const sources = readableFile.name.toLowerCase().endsWith(".docx") ? await extractDocumentPhrases(buffer) : await extractWorkbookPhrases(buffer);
      setFile(readableFile);
      setPhrases(sources.map((source) => ({ source, translation: "" })));
      if (!sources.length) setError("No translatable text was found in this document.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The workbook could not be read.");
    } finally {
      setBusy(null);
    }
  }

  async function translateMissing() {
    const pending = phrases.filter((phrase) => !phrase.translation.trim());
    if (!pending.length) return;
    setBusy("translating");
    setError("");
    try {
      await requestTranslationBatches(pending.map((phrase) => phrase.source), targetLanguage, (sources, translations) => {
        const translated = new Map(sources.map((source, index) => [source, translations[index]]));
        setPhrases((current) => current.map((phrase) => phrase.translation.trim() ? phrase : { ...phrase, translation: translated.get(phrase.source) ?? "" }));
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI translation failed. You can continue manually.");
    } finally {
      setBusy(null);
    }
  }

  async function requestTranslations(phrases: string[], mode: TranslationMode): Promise<string[]> {
    const response = await fetch("/api/instruction-translator/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phrases, mode }),
    });
    const result = await response.json() as { translations?: string[]; error?: string };

    if (!response.ok || !result.translations) {
      const error = result.error ?? "AI translation failed.";
      const providerFailure = /missing api key|unauthorized|forbidden|usage limit|rate limit|fetch failed|unavailable|timed? out|ECONN/i.test(error);
      if (phrases.length === 1 || providerFailure) throw new Error(error);
      const midpoint = Math.ceil(phrases.length / 2);
      return [
        ...await requestTranslations(phrases.slice(0, midpoint), mode),
        ...await requestTranslations(phrases.slice(midpoint), mode),
      ];
    }

    return result.translations;
  }

  async function requestTranslationBatches(sources: string[], mode: TranslationMode, onBatch?: (sources: string[], translations: string[]) => void) {
    const translations: string[] = [];
    const batches = Array.from({ length: Math.ceil(sources.length / translationBatchSize) }, (_, index) => sources.slice(index * translationBatchSize, (index + 1) * translationBatchSize));
    for (let offset = 0; offset < batches.length; offset += translationConcurrency) {
      const results = await Promise.all(batches.slice(offset, offset + translationConcurrency).map(async (batch) => {
        const result = await requestTranslations(batch, mode);
        onBatch?.(batch, result);
        return result;
      }));
      translations.push(...results.flat());
    }
    return translations;
  }

  async function downloadWorkbook() {
    if (!file || missing) return;
    setBusy("downloading");
    setError("");
    try {
      const translations = Object.fromEntries(phrases.map((phrase) => [phrase.source, phrase.translation]));
      const output = isWord ? await buildTranslatedDocument(await file.arrayBuffer(), translations) : await buildTranslatedWorkbook(await file.arrayBuffer(), translations);
      const url = URL.createObjectURL(new Blob([output], { type: isWord ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name.replace(/\.(docx|xlsx)$/i, `-${targetLanguage}.$1`);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The translated workbook could not be created.");
    } finally {
      setBusy(null);
    }
  }

  async function prepareCompanyTemplate() {
    if (!file || missing) return;
    setError("");
    setTemplateMetadata(null);
    setTemplateSteps([]);

    setBusy("preparing-template");
    try {
      const translations = Object.fromEntries(phrases.map((phrase) => [phrase.source, phrase.translation]));
      if (isWord) {
        const translated = await buildTranslatedDocument(await file.arrayBuffer(), translations);
        const blocks = await extractDocumentBlocks(translated);
        if (!blocks.length) throw new Error("No document content was found for company-IK preparation.");
        const response = await fetch("/api/instruction-translator/structure", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocks: blocks.map(({ index, text, images }) => ({ index, text, imageCount: images.length })) }),
        });
        const result = await response.json() as { metadata?: TemplateMetadata; steps?: StructuredStep[]; error?: string };
        if (!response.ok || !result.metadata || !result.steps) throw new Error(result.error ?? "The company-IK draft could not be inferred.");

        const steps: TemplateStep[] = result.steps.map((step) => ({ ...step, images: [] }));
        for (const block of blocks) {
          if (!block.images.length) continue;
          let stepIndex = result.steps.findIndex((step) => block.index >= step.startBlock && block.index <= step.endBlock);
          if (stepIndex < 0) stepIndex = Math.max(0, result.steps.findLastIndex((step) => step.startBlock <= block.index));
          steps[stepIndex].images.push(...block.images);
        }
        setTemplateMetadata({
          ...result.metadata,
          revision: result.metadata.revision || "00",
          date: result.metadata.date || new Intl.DateTimeFormat("en-GB").format(new Date()),
        });
        setTemplateSteps(steps);
        return;
      }

      const translated = await buildTranslatedWorkbook(await file.arrayBuffer(), translations);
      const draft = await extractCompanyInstruction(translated);
      setTemplateMetadata(draft.metadata);
      setTemplateSteps(draft.steps);

      const sources = [...new Set(draft.steps.flatMap((step) => [step.title, step.instruction, ...step.keyPoints]).filter((value) => value.trim()))];
      const indonesian = await requestTranslationBatches(sources, "production-id");
      const translatedContent = new Map(sources.map((source, index) => [source, indonesian[index]]));
      setTemplateSteps(draft.steps.map((step) => ({
        ...step,
        title: translatedContent.get(step.title) ?? step.title,
        instruction: translatedContent.get(step.instruction) ?? step.instruction,
        keyPoints: step.keyPoints.map((point) => translatedContent.get(point) ?? point),
      })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The company-template draft could not be prepared.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadCompanyTemplate() {
    if (!templateMetadata || !templateSteps.length) return;
    setBusy("building-template");
    setError("");
    try {
      const response = await fetch(companyTemplateUrl);
      if (!response.ok) throw new Error("The approved company template could not be loaded.");
      const output = await buildCompanyTemplate(await response.arrayBuffer(), templateMetadata, templateSteps);
      const url = URL.createObjectURL(new Blob([output], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${templateMetadata.ikNumber || "work-instruction"}-company-ik-id.xlsx`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The company-template workbook could not be created.");
    } finally {
      setBusy(null);
    }
  }

  function updateStep(index: number, update: Partial<TemplateStep>) {
    setTemplateSteps((current) => current.map((step, stepIndex) => stepIndex === index ? { ...step, ...update } : step));
  }

  function moveStep(index: number, offset: number) {
    setTemplateSteps((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return <div className="translator-workflow">
    <section className="panel translator-upload">
      <div>
        <p className="eyebrow">AI provider</p>
        <h2>{ninerouterConfigured ? "9Router configured on server" : "9Router uses local defaults"}</h2>
        <p>{ninerouterConfigured ? "The server will authenticate translation requests using its protected environment configuration." : "For deployment, set NINEROUTER_BASE_URL and NINEROUTER_API_KEY in the server environment. Values are never exposed on this page."}</p>
      </div>
    </section>

    <section className="panel translator-upload">
      <div>
        <p className="eyebrow">Source workbook</p>
        <h2>{file?.name ?? "Choose an Office document"}</h2>
        <p>Upload one DOC, DOCX, XLS, or XLSX file up to 250 MB. Legacy files are securely converted by EPMS; modern files are processed in your browser.</p>
      </div>
      <label className="button button--secondary translator-file-button">
        {busy === "converting" ? "Converting legacy file..." : busy === "extracting" ? "Reading document..." : file ? "Choose another file" : "Choose Office file"}
        <input type="file" accept=".doc,.docx,.xls,.xlsx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy !== null} onChange={(event) => { void selectFile(event.target.files?.[0]); event.target.value = ""; }}/>
      </label>
    </section>

    {phrases.length > 0 && <section className="panel translator-review">
      <div className="translator-toolbar">
        <div><p className="eyebrow">Translation review</p><h2>{completed} of {phrases.length} phrases ready</h2><p>Source language is detected automatically. Repeated text shares one {targetLabel} translation throughout the document.</p></div>
        <div className="translator-actions">
          <label className="field translator-language"><span>Target language</span><select value={targetLanguage} disabled={busy !== null || completed > 0} onChange={(event) => setTargetLanguage(event.target.value as TargetLanguage)}><option value="english">English</option><option value="indonesian">Bahasa Indonesia</option></select></label>
          <button type="button" className="button button--secondary" disabled={busy !== null || missing === 0} onClick={() => void translateMissing()}>{busy === "translating" ? "Translating..." : `AI translate to ${targetLabel}`}</button>
          <button type="button" className="button button--primary" disabled={busy !== null || missing > 0} onClick={() => void downloadWorkbook()}>{busy === "downloading" ? "Building document..." : `Download ${targetLabel} ${file?.name.toLowerCase().endsWith(".docx") ? "DOCX" : "XLSX"}`}</button>
        </div>
      </div>
      <p className="translator-disclosure">AI Translate sends only the extracted cell phrases to the configured 9Router provider. The workbook and embedded images are not sent.</p>
      <div className="translator-phrases">
        {phrases.map((phrase, index) => <div className="translator-row" key={phrase.source}>
          <div className="translator-source"><span>Source · {index + 1}</span><p>{phrase.source}</p></div>
          <label><span>{targetLabel}</span><textarea value={phrase.translation} rows={Math.min(6, Math.max(2, phrase.source.split("\n").length))} placeholder={`Enter or generate the ${targetLabel} translation`} onChange={(event) => setPhrases((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, translation: event.target.value } : item))}/></label>
        </div>)}
      </div>
    </section>}

    {file && missing === 0 && (isWord || targetLanguage === "english") && <section className="panel translator-upload">
      <div><p className="eyebrow">Company IK · Bahasa Indonesia</p><h2>Apply the approved company layout</h2><p>{isWord ? "AI infers operational steps and nearby photos from the reviewed Word document, then prepares editable Indonesian IK pages." : "AI rewrites the reviewed English work content into concise Bahasa Indonesia, then EPMS drafts one page per numbered step."} Branding, styles, and print setup remain fixed.</p></div>
      <button type="button" className="button button--secondary" disabled={busy !== null} onClick={() => void prepareCompanyTemplate()}>{busy === "preparing-template" ? "Generating Indonesian IK..." : templateMetadata ? "Regenerate Indonesian IK" : "Prepare Indonesian company IK"}</button>
    </section>}

    {templateMetadata && <section className="panel company-template-review">
      <div className="translator-toolbar"><div><p className="eyebrow">Indonesian IK review</p><h2>{templateSteps.length} work-step pages</h2><p>Review the AI-generated Bahasa Indonesia, metadata, order, and matched source photos before export.</p></div><button type="button" className="button button--primary" disabled={busy !== null} onClick={() => void downloadCompanyTemplate()}>{busy === "building-template" ? "Building company IK..." : "Download Indonesian company IK"}</button></div>
      <div className="company-metadata">
        {([['ikNumber', 'IK number'], ['revision', 'Revision'], ['date', 'Date'], ['product', 'Product'], ['station', 'Station'], ['series', 'Series'], ['cycleTime', 'Cycle time'], ['model', 'Model'], ['author', 'Author']] as Array<[keyof TemplateMetadata, string]>).map(([key, label]) => <label className="field" key={key}><span>{label}</span><input value={templateMetadata[key]} onChange={(event) => setTemplateMetadata((current) => current ? { ...current, [key]: event.target.value } : current)}/></label>)}
      </div>
      <div className="company-step-list">
        {templateSteps.map((step, index) => <article className="company-step" key={index}>
          <div className="company-step-head"><strong>Page {index + 1}</strong><span>{step.images.length} source photo{step.images.length === 1 ? "" : "s"}</span><div><button type="button" className="text-button" disabled={index === 0} onClick={() => moveStep(index, -1)}>Move up</button><button type="button" className="text-button" disabled={index === templateSteps.length - 1} onClick={() => moveStep(index, 1)}>Move down</button></div></div>
          <label className="field"><span>Judul halaman</span><input value={step.title} onChange={(event) => updateStep(index, { title: event.target.value })}/></label>
          <label className="field"><span>Langkah kerja</span><textarea rows={5} value={step.instruction} onChange={(event) => updateStep(index, { instruction: event.target.value })}/></label>
          <label className="field"><span>Poin penting (satu per baris)</span><textarea rows={4} value={step.keyPoints.join("\n")} onChange={(event) => updateStep(index, { keyPoints: event.target.value.split("\n") })}/></label>
        </article>)}
      </div>
    </section>}

    {error && <p className="form-error translator-error" role="alert">{error}</p>}
  </div>;
}
