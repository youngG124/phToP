import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";

const app = express();
app.use(cors());

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const prefix = randomBytes(3).toString("hex"); // 충돌 방지
    cb(null, `${prefix}-${file.originalname}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// 업로드: 단일 파일
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no file" });
  const id = randomBytes(4).toString("hex").slice(0, 6);
  const storedPath = path.join(UPLOAD_DIR, req.file.filename);
  map.set(id, storedPath);
  const n = 1;
  scheduleDeletion(id, n * 60 * 1000); // n분 후 삭제
  console.log('uploaded');

  res.json({
    id,
    filename: req.file.originalname,
    url: `/d/${id}`,
    message: 'uploaded'
  });
});

// 다운로드: id로 파일 전송
app.get("/d/:id", (req, res) => {
  const id = req.params.id;
  const filePath = map.get(id);
  if (!filePath || !fs.existsSync(filePath)) return res.status(410).send("Gone");

  const originalName = path.basename(filePath).split("-").slice(1).join("-");
  res.download(filePath, originalName, (err) => {
    // 전송 성공/실패 후 cleanup
    try { if (!err && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
    map.delete(id);
    const t = timers.get(id);
    if (t) { clearTimeout(t); timers.delete(id); }
  });
});

// 모든 보관 파일 목록
app.get("/api/list", (_req, res) => {
  const items: { id: string; filename: string; url: string; size: number }[] = [];
  for (const [id, filePath] of map.entries()) {
    if (!fs.existsSync(filePath)) continue;
    const stat = fs.statSync(filePath);
    const originalName = path.basename(filePath).split("-").slice(1).join("-");
    items.push({ id, filename: originalName, url: `/d/${id}`, size: stat.size });
  }
  res.json({ count: items.length, items });
});

app.post("/api/clear", (_req, res) => {
  // 타이머/맵 정리
  for (const t of timers.values()) clearTimeout(t);
  timers.clear(); map.clear();

  // 디렉토리 정리
  for (const name of fs.readdirSync(UPLOAD_DIR)) {
    try { fs.unlinkSync(path.join(UPLOAD_DIR, name)); } catch {}
  }
  res.json({ ok: true });
});

// 메모리 매핑 + 청소
const map = new Map<string, string>();
const timers = new Map<string, NodeJS.Timeout>();
function scheduleDeletion(id: string, ms: number) {
  if (timers.has(id)) clearTimeout(timers.get(id)!);
  const t = setTimeout(() => {
    const p = map.get(id);
    if (p && fs.existsSync(p)) {
      try { fs.unlinkSync(p); } catch {}
    }
    map.delete(id);
    timers.delete(id);
  }, ms);
  timers.set(id, t);
}

const TTL_MS = 60_000; // 1분과 일치
function sweepUploads() {
  const now = Date.now();
  for (const name of fs.readdirSync(UPLOAD_DIR)) {
    const full = path.join(UPLOAD_DIR, name);
    try {
      const st = fs.statSync(full);
      if (st.isFile() && now - st.mtimeMs > TTL_MS) fs.unlinkSync(full);
    } catch {}
  }
}
sweepUploads();                // 서버 시작 시 1회
setInterval(sweepUploads, 30_000); // 30초마다 청소

const PORT = process.env.PORT || 3020;
app.listen(PORT, () => {
  console.log(`server -> http://localhost:${PORT}`);
});
