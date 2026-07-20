"use client";

import { useState } from "react";

import { buildTranslatedWorkbook, extractChinesePhrases } from "@/lib/xlsx-translator";

const maxFileSize = 10 * 1024 * 1024;

type Phrase = { source: string; translation: string };
type BusyState = "extracting" | "translating" | "downloading" | null;

export function InstructionTranslator() {
  const [file, setFile] = useState<File | null>(null);
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [busy, setBusy] = useState<BusyState>(null);
  const [error, setError] = useState("");

  const completed = phrases.filter((phrase) => phrase.translation.trim()).length;
  const missing = phrases.length - completed;

  async function selectFile(nextFile?: File) {
    setError("");
    setFile(null);
    setPhrases([]);
    if (!nextFile) return;
    if (!nextFile.name.toLowerCase().endsWith(".xlsx")) return setError("Choose an .xlsx workbook. Legacy and macro-enabled files are not supported.");
    if (nextFile.size > maxFileSize) return setError("The workbook exceeds the 10 MB upload limit.");

    setBusy("extracting");
    try {
      const sources = await extractChinesePhrases(await nextFile.arrayBuffer());
      setFile(nextFile);
      setPhrases(sources.map((source) => ({ source, translation: "" })));
      if (!sources.length) setError("No Chinese cell text was found in this workbook.");
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
      const response = await fetch("/api/instruction-translator/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrases: pending.map((phrase) => phrase.source) }),
      });
      const result = await response.json() as { translations?: string[]; error?: string };
      if (!response.ok || !result.translations) throw new Error(result.error ?? "AI translation failed.");
      const translations = result.translations;
      const translated = new Map(pending.map((phrase, index) => [phrase.source, translations[index]]));
      setPhrases((current) => current.map((phrase) => phrase.translation.trim() ? phrase : { ...phrase, translation: translated.get(phrase.source) ?? "" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI translation failed. You can continue manually.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadWorkbook() {
    if (!file || missing) return;
    setBusy("downloading");
    setError("");
    try {
      const translations = Object.fromEntries(phrases.map((phrase) => [phrase.source, phrase.translation]));
      const output = await buildTranslatedWorkbook(await file.arrayBuffer(), translations);
      const url = URL.createObjectURL(new Blob([output], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name.replace(/\.xlsx$/i, "-english.xlsx");
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The translated workbook could not be created.");
    } finally {
      setBusy(null);
    }
  }

  return <div className="translator-workflow">
    <section className="panel translator-upload">
      <div>
        <p className="eyebrow">Source workbook</p>
        <h2>{file?.name ?? "Choose a work instruction"}</h2>
        <p>Upload one XLSX file up to 10 MB. Cell text is extracted in your browser; images, formulas, styles, merges, and print settings remain unchanged.</p>
      </div>
      <label className="button button--secondary translator-file-button">
        {busy === "extracting" ? "Reading workbook..." : file ? "Choose another file" : "Choose XLSX"}
        <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy !== null} onChange={(event) => { void selectFile(event.target.files?.[0]); event.target.value = ""; }}/>
      </label>
    </section>

    {phrases.length > 0 && <section className="panel translator-review">
      <div className="translator-toolbar">
        <div><p className="eyebrow">Translation review</p><h2>{completed} of {phrases.length} phrases ready</h2><p>Repeated Chinese phrases share one English translation throughout the workbook.</p></div>
        <div className="translator-actions">
          <button type="button" className="button button--secondary" disabled={busy !== null || missing === 0} onClick={() => void translateMissing()}>{busy === "translating" ? "Translating..." : "AI translate missing"}</button>
          <button type="button" className="button button--primary" disabled={busy !== null || missing > 0} onClick={() => void downloadWorkbook()}>{busy === "downloading" ? "Building XLSX..." : "Download English XLSX"}</button>
        </div>
      </div>
      <p className="translator-disclosure">AI Translate sends only the extracted cell phrases to the configured 9Router provider. The workbook and embedded images are not sent.</p>
      <div className="translator-phrases">
        {phrases.map((phrase, index) => <div className="translator-row" key={phrase.source}>
          <div className="translator-source"><span>Chinese · {index + 1}</span><p lang="zh-CN">{phrase.source}</p></div>
          <label><span>English</span><textarea value={phrase.translation} rows={Math.min(6, Math.max(2, phrase.source.split("\n").length))} placeholder="Enter or generate the English translation" onChange={(event) => setPhrases((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, translation: event.target.value } : item))}/></label>
        </div>)}
      </div>
    </section>}

    {error && <p className="form-error translator-error" role="alert">{error}</p>}
  </div>;
}
