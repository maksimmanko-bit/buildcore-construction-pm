import { useRef, useState } from "react";
import { FileSpreadsheet, FileText, Upload } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { extractSearchText } from "../lib/fileText.js";

function cleanFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

export default function DocumentUploader({ companyId, projectId, visitId, onUploaded }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file) {
    if (!file) return;

    if (!supabase) {
      onUploaded?.("Demo mode: подключите Supabase, чтобы загрузить документ.");
      return;
    }

    setBusy(true);

    try {
      const { text, kind } = await extractSearchText(file);
      const bucket = "project-documents";
      const storagePath = `${companyId}/${projectId}/${visitId ?? "documents"}/${Date.now()}-${cleanFileName(file.name)}`;

      const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("visit_files").insert({
        company_id: companyId,
        project_id: projectId,
        visit_id: visitId,
        bucket_id: bucket,
        storage_path: storagePath,
        file_name: file.name,
        file_type: "project_document",
        file_kind: kind,
        mime_type: file.type,
        search_text: text,
      });

      if (insertError) throw insertError;
      onUploaded?.(`Документ добавлен в поиск: ${file.name}`);
    } catch (error) {
      onUploaded?.(error.message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="documentUploader">
      <input
        ref={inputRef}
        accept=".pdf,.xls,.xlsx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        type="file"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
        <Upload size={18} />
        {busy ? "Индексируем..." : "Загрузить PDF / Excel"}
      </button>
      <span>
        <FileText size={16} />
        PDF
      </span>
      <span>
        <FileSpreadsheet size={16} />
        Excel
      </span>
    </div>
  );
}
