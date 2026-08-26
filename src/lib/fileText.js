import * as pdfjs from "pdfjs-dist";
import { unzipSync } from "fflate";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url,
).toString();

export async function extractTextFromPdf(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" "));
  }

  return pages.join("\n\n");
}

export async function extractTextFromExcel(file) {
  const zip = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const decoder = new TextDecoder("utf-8");
  const parser = new DOMParser();

  const readXml = (path) => {
    const entry = zip[path];
    return entry ? parser.parseFromString(decoder.decode(entry), "application/xml") : null;
  };

  const sharedStringsDoc = readXml("xl/sharedStrings.xml");
  const sharedStrings = sharedStringsDoc
    ? Array.from(sharedStringsDoc.getElementsByTagName("si")).map((item) =>
        Array.from(item.getElementsByTagName("t"))
          .map((textNode) => textNode.textContent ?? "")
          .join(""),
      )
    : [];

  const workbookDoc = readXml("xl/workbook.xml");
  const relsDoc = readXml("xl/_rels/workbook.xml.rels");
  const relTargets = new Map(
    relsDoc
      ? Array.from(relsDoc.getElementsByTagName("Relationship")).map((rel) => [
          rel.getAttribute("Id"),
          rel.getAttribute("Target"),
        ])
      : [],
  );

  const sheets = workbookDoc
    ? Array.from(workbookDoc.getElementsByTagName("sheet")).map((sheet, index) => {
        const relationshipId = sheet.getAttribute("r:id");
        const target = relTargets.get(relationshipId) ?? `worksheets/sheet${index + 1}.xml`;
        return {
          name: sheet.getAttribute("name") ?? `Sheet ${index + 1}`,
          path: `xl/${target.replace(/^\/+/, "")}`,
        };
      })
    : Object.keys(zip)
        .filter((path) => path.startsWith("xl/worksheets/sheet") && path.endsWith(".xml"))
        .map((path, index) => ({ name: `Sheet ${index + 1}`, path }));

  return sheets
    .map((sheet) => {
      const doc = readXml(sheet.path);
      if (!doc) return "";

      const rows = Array.from(doc.getElementsByTagName("row")).map((row) =>
        Array.from(row.getElementsByTagName("c"))
          .map((cell) => {
            const type = cell.getAttribute("t");
            const value = cell.getElementsByTagName("v")[0]?.textContent ?? "";
            const inline = cell.getElementsByTagName("t")[0]?.textContent ?? "";
            if (type === "s") return sharedStrings[Number(value)] ?? "";
            if (type === "inlineStr") return inline;
            return value;
          })
          .filter(Boolean)
          .join(", "),
      );

      return [`Sheet: ${sheet.name}`, ...rows].join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

export async function extractSearchText(file) {
  const name = file.name.toLowerCase();
  const type = file.type;

  if (type === "application/pdf" || name.endsWith(".pdf")) {
    return { text: await extractTextFromPdf(file), kind: "pdf" };
  }

  if (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    type.includes("spreadsheet") ||
    type.includes("excel")
  ) {
    return { text: await extractTextFromExcel(file), kind: "excel" };
  }

  return { text: "", kind: "document" };
}
