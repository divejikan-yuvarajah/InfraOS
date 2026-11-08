/** Tiny synthetic files for DocTrace tests. Real structures, a few hundred bytes each. */

export const pdf = (body = "Synthetic test document"): Buffer => Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n% ${body}\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`, "latin1");
export const pdfWithJs = (): Buffer => Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>\nendobj\n%%EOF\n", "latin1");
export const txt = (body = "Synthetic plain text (Synthetic)\n"): Buffer => Buffer.from(body, "utf8");
export const png = (): Buffer => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("synthetic-png-body".padEnd(40, "x"))]);
export const jpeg = (): Buffer => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("synthetic-jpeg-body".padEnd(40, "x"))]);
export const exe = (): Buffer => Buffer.concat([Buffer.from("MZ"), Buffer.alloc(64, 1)]);

export type ZipEntry = { name: string; data?: Buffer; claimUncompressed?: number; claimCompressed?: number };

/** Minimal STORED zip writer. `claimUncompressed` lets a test forge a ZIP-bomb style central directory without any real payload. */
export function zip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const data = e.data ?? Buffer.from("<x/>");
    const name = Buffer.from(e.name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
    locals.push(local, name, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6);
    c.writeUInt32LE(e.claimCompressed ?? data.length, 20); c.writeUInt32LE(e.claimUncompressed ?? data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, name);
    offset += 30 + name.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}
export const docx = (): Buffer => zip([{ name: "[Content_Types].xml" }, { name: "word/document.xml" }]);
export const xlsx = (): Buffer => zip([{ name: "[Content_Types].xml" }, { name: "xl/workbook.xml" }]);
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
