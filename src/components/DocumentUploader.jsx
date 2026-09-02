import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileSpreadsheet, FileText, Image, Upload, X } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { extractSearchText } from "../lib/fileText.js";
import { createAttachmentUrls, uploadVisitAttachment } from "../lib/storage.js";
import { VoiceTextArea } from "./VoiceDictation.jsx";

function isPhoto(file) {
  return file?.type?.startsWith("image/");
}

function isPdf(file) {
  return file?.type === "application/pdf" || /\.pdf$/i.test(file?.name || "");
}

function isExcel(file) {
  return /spreadsheet|excel/i.test(file?.type || "") || /\.(xls|xlsx)$/i.test(file?.name || "");
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
  const [urls, setUrls] = useState({
    thumbnailUrl: attachment.thumbnailUrl || "",
    viewUrl: attachment.viewUrl || "",
  });

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

export default function DocumentUploader({ changeOrderId, compact = false, companyId, dictation, dictationBusy = false, fileType = "project_document", projectId, siteVisitId, uploadMode = "all", visitId, profileId, attachments = [], onUploaded, onOpen, showPreview = true }) {
  const documentInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [pendingPreviews, setPendingPreviews] = useState([]);
  const [photoBatch, setPhotoBatch] = useState([]);
  const objectUrlsRef = useRef([]);

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  async function indexDocumentInBackground(row, file) {
    try {
      setProgressLabel("Indexing document for search...");
      const { text } = await extractSearchText(file);
      const { error } = await supabase.from("visit_files").update({ search_text: text }).eq("id", row.id);
      if (error) throw error;
      onUploaded?.(`${row.file_name} indexed for search.`);
    } catch (error) {
      onUploaded?.(`File uploaded, but search indexing failed: ${error.message}`);
    } finally {
      setProgressLabel("");
    }
  }

  function clearPhotoBatch() {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
    setPhotoBatch([]);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  function requestPhotoCaptions(fileList) {
    const files = Array.from(fileList ?? []).filter(isPhoto);
    if (files.length === 0) return;

    clearPhotoBatch();
    const batchId = Date.now();
    const nextBatch = files.map((file, index) => {
      const previewUrl = URL.createObjectURL(file);
      objectUrlsRef.current.push(previewUrl);
      return {
        id: `${batchId}-${index}-${file.name}`,
        file,
        previewUrl,
        caption: "",
      };
    });
    setPhotoBatch(nextBatch);
  }

  function updateBatchCaption(id, caption) {
    setPhotoBatch((items) => items.map((item) => (item.id === id ? { ...item, caption } : item)));
  }

  function savePhotoBatch(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (dictationBusy) {
      onUploaded?.("Finish dictation before uploading photos.");
      return;
    }
    const entries = photoBatch.map((item) => ({
      caption: item.caption.trim(),
      file: item.file,
    }));
    clearPhotoBatch();
    void uploadEntries(entries);
  }

  async function uploadEntries(entries) {
    const queue = entries.filter((entry) => entry?.file);
    if (queue.length === 0) return;

    if (!supabase) {
      onUploaded?.("Demo mode: connect Supabase to upload files.");
      return;
    }

    if (!companyId || !projectId) {
      onUploaded?.("Select a live project before uploading files.");
      return;
    }

    const pendingIds = [];
    const pendingUrls = [];
    setBusy(true);

    try {
      let uploadedCount = 0;
      for (const [index, entry] of queue.entries()) {
        const file = entry.file;
        const photo = isPhoto(file);
        const photoCaption = photo ? entry.caption || "" : "";

        setProgressLabel(`Uploading ${index + 1} of ${queue.length}...`);
        if (photo) {
          const previewUrl = URL.createObjectURL(file);
          const pendingId = `pending-${Date.now()}-${index}-${file.name}`;
          pendingIds.push(pendingId);
          pendingUrls.push(previewUrl);
          setPendingPreviews((items) => [
            {
              id: pendingId,
              file_name: file.name,
              file_kind: "photo",
              mime_type: file.type,
              photo_caption: photoCaption,
              created_at: new Date().toISOString(),
              thumbnailUrl: previewUrl,
              viewUrl: previewUrl,
              localPreview: true,
            },
            ...items,
          ]);
        }

        const row = await uploadVisitAttachment({
          companyId,
          changeOrderId,
          fileType,
          projectId,
          siteVisitId,
          visitId,
          profileId,
          file,
          photoCaption,
          searchText: photo ? photoCaption : "Indexing in background...",
        });

        uploadedCount += 1;
        if (!photo) void indexDocumentInBackground(row, file);
      }

      onUploaded?.(`${uploadedCount} file${uploadedCount === 1 ? "" : "s"} uploaded to Supabase Storage.`);
    } catch (error) {
      onUploaded?.(error.message);
      setProgressLabel("");
    } finally {
      setBusy(false);
      setProgressLabel("");
      if (pendingIds.length > 0) {
        window.setTimeout(() => {
          setPendingPreviews((items) => items.filter((item) => !pendingIds.includes(item.id)));
          pendingUrls.forEach((url) => URL.revokeObjectURL(url));
        }, 2400);
      }
      if (documentInputRef.current) documentInputRef.current.value = "";
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  const photoBatchSheet =
    photoBatch.length > 0
      ? createPortal(
          <div className="captionSheetOverlay" role="dialog" aria-modal="true" aria-label="Photo notes">
            <div className="captionSheetBackdrop" />
            <section className="captionSheet photoBatchSheet">
              <button className="captionClose" type="button" onClick={clearPhotoBatch} aria-label="Close">
                <X size={18} />
              </button>
              <h3>Photo notes</h3>
              <p>{photoBatch.length} photo{photoBatch.length === 1 ? "" : "s"} selected. Notes are optional and can be added later.</p>
              <div className="photoBatchGrid">
                {photoBatch.map((item) => (
                  <label className="photoBatchCard" key={item.id}>
                    <img src={item.previewUrl} alt="" />
                    <span title={item.file.name}>{item.file.name}</span>
                    <VoiceTextArea
                      dictation={dictation}
                      value={item.caption}
                      onChange={(value) => updateBatchCaption(item.id, value)}
                      placeholder="Add photo note..."
                      rows={3}
                    />
                  </label>
                ))}
              </div>
              <div className="captionActions">
                <button className="outlineButton" type="button" onClick={clearPhotoBatch}>
                  Cancel
                </button>
                <button className="addButton" type="button" onClick={savePhotoBatch} disabled={busy || dictationBusy}>
                  Upload photos
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={compact ? "attachmentManager compactUploader" : "attachmentManager"}>
      <div className="uploadControls">
        <input
          ref={documentInputRef}
          accept={uploadMode === "pdf" ? ".pdf,application/pdf" : uploadMode === "excel" ? ".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : ".pdf,.xls,.xlsx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
          data-upload-input="document"
          multiple
          type="file"
          onChange={(event) => {
            const selectedFiles = Array.from(event.target.files ?? []).filter((file) => {
              if (uploadMode === "pdf") return isPdf(file);
              if (uploadMode === "excel") return isExcel(file);
              return true;
            });
            uploadEntries(selectedFiles.map((file) => ({ file })));
          }}
        />
        <input ref={photoInputRef} accept="image/jpeg,image/png,image/webp" data-upload-input="photo" multiple type="file" onChange={(event) => requestPhotoCaptions(event.target.files)} />

        {(uploadMode === "all" || uploadMode === "photo") && (
          <button type="button" onClick={() => photoInputRef.current?.click()} disabled={busy || dictationBusy}>
            <Image size={18} />
            Photo
          </button>
        )}
        {(uploadMode === "all" || uploadMode === "pdf" || uploadMode === "excel") && (
          <button type="button" onClick={() => documentInputRef.current?.click()} disabled={busy || dictationBusy}>
            <Upload size={18} />
            {busy ? "Saving..." : uploadMode === "pdf" ? "PDF" : uploadMode === "excel" ? "Excel" : "PDF / Excel"}
          </button>
        )}
      </div>

      {showPreview && (
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
      )}

      {showPreview && (
        <div className="attachmentStrip" aria-label="Saved attachments">
          {pendingPreviews.length || attachments.length ? (
            [...pendingPreviews, ...attachments].slice(0, 6).map((attachment) => <AttachmentThumbnail attachment={attachment} key={attachment.id} onOpen={onOpen} />)
          ) : (
            <div className="emptyAttachments">No saved files yet</div>
          )}
        </div>
      )}

      {progressLabel && <div className="uploadProgressPill">{progressLabel}</div>}

      {photoBatchSheet}
    </div>
  );
}
