import { supabase } from "./supabase";

export function dataUrlToBlob(dataUrl) {
  const [metadata, base64] = dataUrl.split(",");
  const mime = metadata.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mime });
}

export async function uploadAnnotatedVisitPhoto({ companyId, projectId, visitId, dataUrl, annotationJson }) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const folder = visitId || "project-files";
  const storagePath = `${companyId}/${projectId}/${folder}/annotated-${timestamp}.jpg`;
  const blob = dataUrlToBlob(dataUrl);

  const { error: uploadError } = await supabase.storage.from("visit-photos").upload(storagePath, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });

  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from("visit_files").insert({
    company_id: companyId,
    project_id: projectId,
    visit_id: visitId || null,
    bucket_id: "visit-photos",
    storage_path: storagePath,
    file_name: storagePath.split("/").at(-1),
    file_type: "annotated_photo",
    mime_type: "image/jpeg",
    annotation_json: annotationJson,
  });

  if (insertError) throw insertError;
  return storagePath;
}

export function getAttachmentBucket(file) {
  return file.type.startsWith("image/") ? "visit-photos" : "project-documents";
}

export function getAttachmentKind(file) {
  const name = file.name.toLowerCase();
  if (file.type.startsWith("image/")) return "photo";
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".xls") || name.endsWith(".xlsx")) return "excel";
  return "document";
}

export function getAttachmentType(file) {
  const kind = getAttachmentKind(file);
  const name = file.name.toLowerCase();

  if (kind === "photo") {
    if (name.includes("before")) return "before_photo";
    return "completion_photo";
  }

  if (kind === "pdf" && name.includes("safety")) return "safety_form";
  return "project_document";
}

export function cleanStorageFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

export async function uploadVisitAttachment({ companyId, projectId, visitId, profileId, file, searchText = "" }) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const bucket = getAttachmentBucket(file);
  const folder = visitId || "project-files";
  const storagePath = `${companyId}/${projectId}/${folder}/${Date.now()}-${cleanStorageFileName(file.name)}`;
  const kind = getAttachmentKind(file);

  const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (uploadError) throw uploadError;

  const { data, error: insertError } = await supabase
    .from("visit_files")
    .insert({
      company_id: companyId,
      project_id: projectId,
      visit_id: visitId || null,
      uploaded_by: profileId || null,
      bucket_id: bucket,
      storage_path: storagePath,
      file_name: file.name,
      file_type: getAttachmentType(file),
      file_kind: kind,
      mime_type: file.type || "application/octet-stream",
      search_text: searchText,
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return data;
}

export async function createAttachmentUrls(attachment, expiresIn = 60 * 60) {
  if (!supabase || !attachment?.bucket_id || !attachment?.storage_path) return {};

  const isPhoto = attachment.file_kind === "photo" || attachment.mime_type?.startsWith("image/");
  const storage = supabase.storage.from(attachment.bucket_id);

  const [viewResult, thumbResult] = await Promise.all([
    storage.createSignedUrl(attachment.storage_path, expiresIn),
    isPhoto
      ? storage.createSignedUrl(attachment.storage_path, expiresIn, {
          transform: { width: 360, height: 260, resize: "cover" },
        })
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (viewResult.error) throw viewResult.error;
  if (thumbResult.error) throw thumbResult.error;

  return {
    viewUrl: viewResult.data?.signedUrl,
    thumbnailUrl: thumbResult.data?.signedUrl,
  };
}
