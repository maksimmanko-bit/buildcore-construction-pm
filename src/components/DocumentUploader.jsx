import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, FileText, Image, Upload, X } from "lucide-react";
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

export default function DocumentUploader({ companyId, projectId, visitId, profileId, attachments = [], onUploaded, onOpen, showPreview = true }) {
  const documentInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [pendingPreviews, setPendingPreviews] = useState([]);
  const [captionRequest, setCaptionRequest] = useState(null);
  const [captionText, setCaptionText] = useState("");

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

  function requestPhotoCaption(file) {
    if (!file) return;
    setCaptionRequest(file);
    setCaptionText("");
  }

  function closeCaptionRequest() {
    setCaptionRequest(null);
    setCaptionText("");
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  function saveCaptionRequest() {
    const file = captionRequest;
    setCaptionRequest(null);
    setCaptionText("");
    if (photoInputRef.current) photoInputRef.current.value = "";
    void handleFile(file, captionText.trim());
  }

  async function handleFile(file, providedCaption = "") {
    if (!file) return;
    const photo = isPhoto(file);
    const photoCaption = photo ? providedCaption : "";
    const pendingId = `pending-${Date.now()}-${file.name}`;
    const previewUrl = photo ? URL.createObjectURL(file) : "";

    if (!supabase) {
      onUploaded?.("Demo mode: connect Supabase to upload files.");
      return;
    }

    if (!companyId || !projectId) {
      onUploaded?.("Select a live project before uploading files.");
      return;
    }

    setBusy(true);
    setProgressLabel(photo ? "Uploading photo..." : "Uploading document...");
    if (photo && previewUrl) {
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

    try {
      const row = await uploadVisitAttachment({
        companyId,
        projectId,
        visitId,
        profileId,
        file,
        photoCaption,
        searchText: photo ? photoCaption : "Indexing in background...",
      });

      onUploaded?.(`${photo ? "Photo" : "Document"} uploaded to Supabase Storage: ${row.file_name}`);
      if (!photo) void indexDocumentInBackground(row, file);
    } catch (error) {
      onUploaded?.(error.message);
      setProgressLabel("");
    } finally {
      setBusy(false);
      if (photo) setProgressLabel("");
      if (previewUrl) {
        window.setTimeout(() => {
          setPendingPreviews((items) => items.filter((item) => item.id !== pendingId));
        }, 2400);
      }
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
        <input ref={photoInputRef} accept="image/jpeg,image/png,image/webp" type="file" onChange={(event) => requestPhotoCaption(event.target.files?.[0])} />

        <button type="button" onClick={() => photoInputRef.current?.click()} disabled={busy}>
          <Image size={18} />
          Photo
        </button>
        <button type="button" onClick={() => documentInputRef.current?.click()} disabled={busy}>
          <Upload size={18} />
          {busy ? "Saving..." : "PDF / Excel"}
        </button>
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

      {captionRequest && (
        <div className="captionSheetOverlay" role="dialog" aria-modal="true" aria-label="Photo note">
          <div className="captionSheetBackdrop" onClick={closeCaptionRequest} />
          <section className="captionSheet">
            <button className="captionClose" type="button" onClick={closeCaptionRequest} aria-label="Close">
              <X size={18} />
            </button>
            <h3>Photo note</h3>
            <p>{captionRequest.name}</p>
            <textarea
              autoFocus
              value={captionText}
              onChange={(event) => setCaptionText(event.target.value)}
              placeholder="Add a short explanation for this photo"
              rows={4}
            />
            <div className="captionActions">
              <button className="outlineButton" type="button" onClick={closeCaptionRequest}>
                Cancel
              </button>
              <button className="addButton" type="button" onClick={saveCaptionRequest}>
                Continue
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
