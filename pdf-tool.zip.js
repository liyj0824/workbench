/* pdf-tool.zip.js
 * 纯 JS 实现：CRC32 + store 模式 ZIP 写入器 + EPUB 生成器。
 * 不依赖任何外部库（无 JSZip）。浏览器与 node 通用（UMD）。
 * 用于「PDF 转 TXT / EPUB」工具页，把 OCR 出的中文文本打包成合法 EPUB。
 */
(function (global) {
  "use strict";

  /* ---------- CRC32 ---------- */
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) {
      c = (CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8)) >>> 0;
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /* ---------- 字节工具 ---------- */
  function strBytes(s) { return new TextEncoder().encode(s); }
  function concat(chunks) {
    var len = 0, i;
    for (i = 0; i < chunks.length; i++) len += chunks[i].length;
    var out = new Uint8Array(len), off = 0;
    for (i = 0; i < chunks.length; i++) { out.set(chunks[i], off); off += chunks[i].length; }
    return out;
  }

  function localHeader(nameBytes, crc, size) {
    var buf = new Uint8Array(30 + nameBytes.length);
    var dv = new DataView(buf.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);      // version needed
    dv.setUint16(6, 0x0800, true);  // flags: UTF-8 文件名
    dv.setUint16(8, 0, true);       // method: store
    dv.setUint16(10, 0, true);      // mod time
    dv.setUint16(12, 0, true);      // mod date
    dv.setUint32(14, crc, true);
    dv.setUint32(18, size, true);
    dv.setUint32(22, size, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);      // extra len
    buf.set(nameBytes, 30);
    return buf;
  }
  function centralHeader(nameBytes, crc, size, offset) {
    var buf = new Uint8Array(46 + nameBytes.length);
    var dv = new DataView(buf.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true);      // version made by
    dv.setUint16(6, 20, true);      // version needed
    dv.setUint16(8, 0x0800, true);  // flags
    dv.setUint16(10, 0, true);      // method
    dv.setUint16(12, 0, true);      // time
    dv.setUint16(14, 0, true);      // date
    dv.setUint32(16, crc, true);
    dv.setUint32(20, size, true);
    dv.setUint32(24, size, true);
    dv.setUint16(28, nameBytes.length, true);
    dv.setUint16(30, 0, true);      // extra
    dv.setUint16(32, 0, true);      // comment
    dv.setUint16(34, 0, true);      // disk #
    dv.setUint16(36, 0, true);      // internal attr
    dv.setUint32(38, 0, true);      // external attr
    dv.setUint32(42, offset, true);
    buf.set(nameBytes, 46);
    return buf;
  }
  function eocd(cdSize, cdOffset, count) {
    var buf = new Uint8Array(22);
    var dv = new DataView(buf.buffer);
    dv.setUint32(0, 0x06054b50, true);
    dv.setUint16(4, 0, true);
    dv.setUint16(6, 0, true);
    dv.setUint16(8, count, true);
    dv.setUint16(10, count, true);
    dv.setUint32(12, cdSize, true);
    dv.setUint32(16, cdOffset, true);
    dv.setUint16(20, 0, true);
    return buf;
  }

  /* files: [{ name: string, data: Uint8Array }] -> Uint8Array(zip) */
  function buildZip(files) {
    var chunks = [], centrals = [], offset = 0, i;
    for (i = 0; i < files.length; i++) {
      var f = files[i];
      var nameBytes = strBytes(f.name);
      var data = f.data instanceof Uint8Array ? f.data : strBytes(String(f.data));
      var crc = crc32(data);
      var lh = localHeader(nameBytes, crc, data.length);
      chunks.push(lh); chunks.push(data);
      centrals.push(centralHeader(nameBytes, crc, data.length, offset));
      offset += lh.length + data.length;
    }
    var cdSize = 0;
    for (i = 0; i < centrals.length; i++) cdSize += centrals[i].length;
    var cd = concat(centrals);
    var eo = eocd(cdSize, offset, files.length);
    return concat(chunks.concat([cd, eo]));
  }

  /* ---------- EPUB ---------- */
  function escXml(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }
  function uuid() {
    // 简单确定性 uuid（无需 crypto）
    var s = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
    return s.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /* chapters: [{ title: string, lines: string[] }]
   * opts: { title, author } */
  function buildEpub(opts) {
    opts = opts || {};
    var title = opts.title || "转换文档";
    var author = opts.author || "未知";
    var chapters = opts.chapters && opts.chapters.length ? opts.chapters
      : [{ title: "正文", lines: (opts.text || "").split("\n") }];
    var bookid = "urn:uuid:" + uuid();
    var n = chapters.length;

    var manifestItems = "";
    var spineItems = '<itemref idref="nav"/>';
    var navOl = "";
    var oebps = [];

    for (var i = 0; i < n; i++) {
      var id = "chap" + (i + 1);
      var ch = chapters[i];
      var body = "";
      for (var j = 0; j < ch.lines.length; j++) {
        var ln = ch.lines[j];
        if (ln == null) continue;
        ln = String(ln).replace(/\r/g, "");
        if (ln.trim().length === 0) body += "<p> </p>";
        else body += "<p>" + escXml(ln) + "</p>";
      }
      var xhtml =
        '<?xml version="1.0" encoding="utf-8"?>\n' +
        '<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh" lang="zh">\n' +
        '<head><meta charset="utf-8"/><title>' + escXml(ch.title || ("第" + (i + 1) + "节")) + '</title>' +
        '<style>body{font-family:"Noto Serif CJK SC","Songti SC",serif;line-height:1.8;margin:1em;}h1{font-size:1.3em;}</style></head>\n' +
        "<body>\n<h1>" + escXml(ch.title || ("第" + (i + 1) + "节")) + "</h1>\n" + body + "\n</body>\n</html>\n";
      oebps.push({ name: "OEBPS/" + id + ".xhtml", data: strBytes(xhtml) });
      manifestItems += '<item id="' + id + '" href="' + id + '.xhtml" media-type="application/xhtml+xml"/>\n  ';
      spineItems += '<itemref idref="' + id + '"/>';
      navOl += '<li><a href="' + id + '.xhtml">' + escXml(ch.title || ("第" + (i + 1) + "节")) + "</a></li>\n  ";
    }

    var contentOpf =
      '<?xml version="1.0" encoding="utf-8"?>\n' +
      '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="zh">\n' +
      '  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n' +
      '    <dc:identifier id="bookid">' + bookid + "</dc:identifier>\n" +
      "    <dc:title>" + escXml(title) + "</dc:title>\n" +
      "    <dc:creator>" + escXml(author) + "</dc:creator>\n" +
      "    <dc:language>zh</dc:language>\n" +
      '    <meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>\n' +
      "  </metadata>\n" +
      "  <manifest>\n  " +
      '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>\n  ' +
      manifestItems +
      "  </manifest>\n" +
      "  <spine>\n  " + spineItems + "\n  </spine>\n" +
      "</package>\n";

    var navXhtml =
      '<?xml version="1.0" encoding="utf-8"?>\n' +
      '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh" lang="zh">\n' +
      "<head><title>目录</title></head>\n<body>\n" +
      '<nav epub:type="toc" id="toc">\n<h1>目录</h1>\n<ol>\n  ' + navOl + "</ol>\n</nav>\n</body>\n</html>\n";

    var container =
      '<?xml version="1.0"?>\n' +
      '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n' +
      "  <rootfiles>\n" +
      '    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>\n' +
      "  </rootfiles>\n</container>\n";

    var mimetype = strBytes("application/epub+zip");

    var files = [
      { name: "mimetype", data: mimetype },
      { name: "META-INF/container.xml", data: strBytes(container) },
      { name: "OEBPS/content.opf", data: strBytes(contentOpf) },
      { name: "OEBPS/nav.xhtml", data: strBytes(navXhtml) }
    ];
    for (var k = 0; k < oebps.length; k++) files.push(oebps[k]);

    return buildZip(files);
  }

  var api = { crc32: crc32, buildZip: buildZip, buildEpub: buildEpub, escXml: escXml };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.PdfToolZip = api;
})(typeof window !== "undefined" ? window : globalThis);
