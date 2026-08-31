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

export async function replaceVisitPhotoWithAnnotation({ attachment, dataUrl, annotationJson, actorId }) {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (!attachment?.id || !attachment?.bucket_id || !attachment?.storage_path) throw new Error("Missing photo details.");

  const blob = dataUrlToBlob(dataUrl);
  const history = Array.isArray(attachment.annotation_history) ? attachment.annotation_history : [];
  const nextHistory = [
    {
      at: new Date().toISOString(),
      by: actorId || null,
      action: "annotation_saved",
      objectCount: annotationJson?.objects?.length ?? 0,
    },
    ...history,
  ];

  const { error: uploadError } = await supabase.storage.from(attachment.bucket_id).upload(attachment.storage_path, blob, {
    contentType: "image/jpeg",
    upsert: true,
  });

  if (uploadError) throw uploadError;

  const { data, error: updateError } = await supabase
    .from("visit_files")
    .update({
      annotation_json: annotationJson,
      annotation_history: nextHistory,
      mime_type: "image/jpeg",
      file_kind: "photo",
    })
    .eq("id", attachment.id)
    .select()
    .single();

  if (updateError) throw updateError;
  return data;
}

export async function deleteVisitFile(attachment) {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (!attachment?.id || !attachment?.bucket_id || !attachment?.storage_path) throw new Error("Missing file details.");

  const { error: removeError } = await supabase.storage.from(attachment.bucket_id).remove([attachment.storage_path]);
  if (removeError) throw removeError;

  const { error: deleteError } = await supabase.from("visit_files").delete().eq("id", attachment.id);
  if (deleteError) throw deleteError;
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

export function getAttachmentType(file, visitId) {
  const kind = getAttachmentKind(file);
  const name = file.name.toLowerCase();

  if (kind === "photo") {
    if (!visitId) return "project_document";
    if (name.includes("before")) return "before_photo";
    return "completion_photo";
  }

  if (kind === "pdf" && name.includes("safety")) return "safety_form";
  return "project_document";
}

export function cleanStorageFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

function escapePdfText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export function makeSimplePdfBlob(lines) {
  const content = [
    "BT",
    "/F1 12 Tf",
    "50 780 Td",
    "16 TL",
    ...lines.flatMap((line, index) => {
      const value = String(line ?? "").slice(0, 92);
      return index === 0 ? [`(${escapePdfText(value)}) Tj`] : ["T*", `(${escapePdfText(value)}) Tj`];
    }),
    "ET",
  ].join("\n");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj",
    `5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object) => {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

export async function uploadVisitGeneratedFile({
  bucket = "project-documents",
  changeOrderId,
  companyId,
  folderDescription = "",
  folderName = "",
  projectId,
  profileId,
  siteVisitId,
  visitId,
  blob,
  fileName,
  fileType = "project_document",
  fileKind = "pdf",
  mimeType = "application/pdf",
  photoCaption = "",
  searchText = "",
}) {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (!companyId || !projectId || !blob || !fileName) throw new Error("Missing file upload details.");

  const folder = visitId || (siteVisitId ? `site-visit-${siteVisitId}` : changeOrderId ? `change-order-${changeOrderId}` : "project-files");
  const storagePath = `${companyId}/${projectId}/${folder}/${Date.now()}-${cleanStorageFileName(fileName)}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, blob, {
    contentType: mimeType,
    upsert: false,
  });

  if (uploadError) throw uploadError;

  const { data, error: insertError } = await supabase
    .from("visit_files")
    .insert({
      company_id: companyId,
      project_id: projectId,
      visit_id: visitId || null,
      site_visit_id: siteVisitId || null,
      change_order_id: changeOrderId || null,
      uploaded_by: profileId || null,
      bucket_id: bucket,
      storage_path: storagePath,
      file_name: fileName,
      file_type: fileType,
      file_kind: fileKind,
      mime_type: mimeType,
      photo_caption: photoCaption || null,
      folder_name: folderName || null,
      folder_description: folderDescription || null,
      search_text: searchText,
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return data;
}

export async function uploadVisitAttachment({ changeOrderId, companyId, folderDescription = "", folderName = "", projectId, siteVisitId, visitId, profileId, file, photoCaption = "", searchText = "" }) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const bucket = getAttachmentBucket(file);
  const folder = visitId || (siteVisitId ? `site-visit-${siteVisitId}` : changeOrderId ? `change-order-${changeOrderId}` : "project-files");
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
      site_visit_id: siteVisitId || null,
      change_order_id: changeOrderId || null,
      uploaded_by: profileId || null,
      bucket_id: bucket,
      storage_path: storagePath,
      file_name: file.name,
      file_type: getAttachmentType(file, visitId),
      file_kind: kind,
      mime_type: file.type || "application/octet-stream",
      photo_caption: kind === "photo" ? photoCaption || null : null,
      folder_name: folderName || null,
      folder_description: folderDescription || null,
      search_text: searchText,
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return data;
}

export async function uploadVisitPhoto({ companyId, projectId, visitId, profileId, file, fileType = "completion_photo", photoCaption = "", searchText = "" }) {
  return uploadVisitGeneratedFile({
    bucket: "visit-photos",
    companyId,
    projectId,
    visitId,
    profileId,
    blob: file,
    fileName: file.name,
    fileType,
    fileKind: "photo",
    mimeType: file.type || "image/jpeg",
    photoCaption,
    searchText,
  });
}

export async function uploadProfileAvatar({ companyId, profileId, file }) {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (!companyId || !profileId || !file) throw new Error("Missing avatar upload details.");

  const extension = cleanStorageFileName(file.name).split(".").pop() || "jpg";
  const storagePath = `${companyId}/${profileId}/avatar-${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from("profile-avatars").upload(storagePath, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });

  if (error) throw error;
  return storagePath;
}

export async function createProfileAvatarUrl(avatarPath, expiresIn = 60 * 60) {
  if (!supabase || !avatarPath) return "";

  const { data, error } = await supabase.storage.from("profile-avatars").createSignedUrl(avatarPath, expiresIn, {
    transform: { width: 160, height: 160, resize: "cover" },
  });

  if (error) throw error;
  return data?.signedUrl ?? "";
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
