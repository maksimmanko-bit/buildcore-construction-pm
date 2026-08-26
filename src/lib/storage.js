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
  const storagePath = `${companyId}/${projectId}/${visitId}/annotated-${timestamp}.jpg`;
  const blob = dataUrlToBlob(dataUrl);

  const { error: uploadError } = await supabase.storage.from("visit-photos").upload(storagePath, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });

  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from("visit_files").insert({
    company_id: companyId,
    project_id: projectId,
    visit_id: visitId,
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
