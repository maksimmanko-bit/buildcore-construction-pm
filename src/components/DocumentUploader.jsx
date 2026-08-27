import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, FileText, Image, Upload } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { extractSearchText } from "../lib/fileText.js";
import { createAttachmentUrls, uploadVisitAttachment } from "../lib/storage.js";

function isPhoto(file) {
  return file?.type?.startsWith("image/");
}

function isAttachmentPhoto(attachment) {
  return attachment.file_kind === "photo" || attachment.mime_type?.startsWith("image/");
}

function getDocLabel(attachment) {
  if (attachment.file_kind === "pdf") return "PDF";
  if (attachment.file_kind === "excel" || attachment.file_kind === "xlsx") return "Excel";
  return "File";
}

function AttachmentThumbnail({ attachment, onOpen }) {
  const [urls, setUrls] = useState({});

  useEffect(() => {
    let alive = true;

    async function loadUrls() {
      try {
        const nextUrls = await createAttachmentUrls(attachment);
        if (alive) setUrls(nextUrls);
      } catch {
        if (alive) setUrls({});
      }
    }

    if (supabase && attachment?.storage_path) loadUrls();
    return () => {
      alive = false;
    };
  }, [attachment]);

  const photo = isAttachmentPhoto(attachment);

  return (
    <button className={photo ? "attachmentCard photo" : "attachmentCard document"} type="button" onClick={() => onOpen?.({ ...attachment, ...urls })}>
      <span className="attachmentThumb">
        {photo && urls.thumbnailUrl ? (
          <img src={urls.thumbnailUrl} alt="" />
        ) : attachment.file_kind === "excel" ? (
          <span className="spreadsheetPreview" aria-hidden="true" />
        ) : (
          <FileText size={24} />
        )}
      </span>
      <span className="attachmentMeta">
        <strong title={attachment.file_name}>{attachment.file_name}</strong>
        <small>{photo ? attachment.photo_caption || "Photo" : getDocLabel(attachment)}</small>
      </span>
    </button>
  );
}

export default function DocumentUploader({ companyId, projectId, visitId, profileId, attachments = [], onUploaded, onOpen }) {
  const documentInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file) {
    if (!file) return;
    const photo = isPhoto(file);
    const photoCaption = photo ? window.prompt("Add a short note for this photo:", "")?.trim() ?? "" : "";

    if (!supabase) {
      onUploaded?.("Demo mode: connect Supabase to upload files.");
      return;
    }

    if (!companyId || !projectId) {
      onUploaded?.("Select a live project before uploading files.");
      return;
    }

    setBusy(true);

    try {
      const { text } = photo ? { text: photoCaption } : await extractSearchText(file);
      const row = await uploadVisitAttachment({
        companyId,
        projectId,
        visitId,
        profileId,
        file,
        photoCaption,
        searchText: text,
      });

      onUploaded?.(`${photo ? "Photo" : "Document"} uploaded to Supabase Storage: ${row.file_name}`);
    } catch (error) {
      onUploaded?.(error.message);
    } finally {
      setBusy(false);
      if (documentInputRef.current) documentInputRef.current.value = "";
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  return (
    <div className="attachmentManager">
      <div className="uploadControls">
        <input
          ref={documentInputRef}
          accept=".pdf,.xls,.xlsx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          type="file"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
        <input ref={photoInputRef} accept="image/jpeg,image/png,image/webp" type="file" onChange={(event) => handleFile(event.target.files?.[0])} />

        <button type="button" onClick={() => photoInputRef.current?.click()} disabled={busy}>
          <Image size={18} />
          Photo
        </button>
        <button type="button" onClick={() => documentInputRef.current?.click()} disabled={busy}>
          <Upload size={18} />
          {busy ? "Saving..." : "PDF / Excel"}
        </button>
      </div>

      <div className="attachmentLegend">
        <span>
          <Image size={15} />
          Photos
        </span>
        <span>
          <FileText size={15} />
          PDF
        </span>
        <span>
          <FileSpreadsheet size={15} />
          Excel
        </span>
      </div>

      <div className="attachmentStrip" aria-label="Saved attachments">
        {attachments.length ? (
          attachments.slice(0, 6).map((attachment) => <AttachmentThumbnail attachment={attachment} key={attachment.id} onOpen={onOpen} />)
        ) : (
          <div className="emptyAttachments">No saved files yet</div>
        )}
      </div>
    </div>
  );
}
