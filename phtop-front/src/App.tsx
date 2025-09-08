import { useRef, useState } from "react";

type UploadResult =
  | { ok: true; id: string; filename: string; url: string }
  | { ok: false; name: string; error: string };

async function uploadOne(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  try {
    const r = await fetch("/api/upload", { method: "POST", body: form });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json(); // { id, filename, url: "/d/:id" }
    // 절대 URL로 변환(복사/공유 용이)
    const abs = new URL(data.url, window.location.origin).toString();
    return { ok: true, id: data.id, filename: data.filename, url: abs };
  } catch (e: any) {
    return { ok: false, name: file.name, error: String(e?.message || e) };
  }
}

// 모든 업로드 파일 서버에서 삭제
export async function clearAll(): Promise<{ ok: boolean }> {
  const res = await fetch("/api/clear", {
    method: "POST",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json(); // { ok: true }
}

export default function App() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [, setItems] = useState<UploadResult[]>([]);
  const [message, setMessage] = useState("");
  const [msg, setMsg] = useState("");

  const onPick = () => inputRef.current?.click();

  async function uploadMany(files: File[], concurrency = 3, setMessage: (s: string)=>void) {
    const results: UploadResult[] = new Array(files.length);
    let idx = 0;

    async function worker() {
      while (idx < files.length) {
        const i = idx++;
        results[i] = await uploadOne(files[i]);
        setMessage(idx + "/" + files.length);
      }
    }
    const workers = Array.from(
      { length: Math.min(concurrency, files.length) },
      worker
    );
    await Promise.all(workers);
    return results;
  }

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await clearAll();
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy(true);
    setMessage("업로드 중… (동시 3개)");
    const results = await uploadMany(files, 3, setMessage);
    setItems(results);
    setBusy(false);
    setMessage("uploaded! download it in PC");
    // 같은 파일 재업로드 허용
    if (inputRef.current) inputRef.current.value = "";
  };

  // App.tsx 중 일부
  async function fetchList() {
    const r = await fetch("/api/list");
    if (!r.ok) throw new Error("list failed");
    const data = await r.json();
    return data.items as Array<{ url: string; filename: string }>;
  }

  function triggerDownload(url: string, filename: string) {
    const a = document.createElement("a");
    a.href = url;                 // 같은 오리진이면 download 동작 잘 됨
    a.download = filename;        // 서버에서 Content-Disposition도 주고 있으니 안전
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  async function downloadAllIndividually(setMsg: (s: string)=>void) {
    setMsg("목록 불러오는 중…");
    const items = await fetchList();
    if (!items.length) { setMsg("다운로드할 파일이 없습니다."); return; }

    setMsg(`다운로드 시작 (${items.length}개)…`);
    // 한 번의 사용자 클릭으로 연속 트리거 → 300~700ms 간격 권장(브라우저 차단 방지)
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      triggerDownload(it.url, it.filename);
      setMsg(`다운로드 중… ${i + 1}/${items.length}`);
      await sleep(500);
    }
    setMsg(`완료! 총 ${items.length}개`);
  }   

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{
        width: 420,
        maxWidth: "100%",
        border: "1px solid #eee",
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 8px 24px rgba(0,0,0,0.08)"
      }}>
        <h1 style={{ margin: 5, fontSize: 20, fontWeight: 700 }}>PHTOP - phone to PC</h1>
        <h2 style={{ margin: 5, fontSize: 15, fontWeight: 500 }}>most simple webapp to move your file from phone to PC</h2>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onChange}
          style={{ display: "none" }}
        />
        <button
          onClick={onPick}
          disabled={busy}
          style={{
            width: "100%", padding: "12px 14px", borderRadius: 12,
            border: "1px solid #ddd", background: busy ? "#f5f5f5" : "#fff",
            cursor: busy ? "default" : "pointer", fontSize: 16
          }}
        >
          {busy ? "업로드 중…" : "choose pictures and upload in Phone"}
        </button>

        <div style={{ marginTop: 10, fontSize: 13, color: "#444" }}>{message}</div>

        <button onClick={() => downloadAllIndividually(setMsg)} style={{ width: "100%", padding: 10, borderRadius: 10 }}>
          download it all in PC
        </button>
        <div style={{marginTop: 8, fontSize: 13 }}>{msg}</div>

        <div style={{marginTop: 8, fontSize: 13 }}>
          설명 : 1분이 지나거나 누군가가 파일을 업로드하면 기존 파일은 서버에서 삭제됩니다. 삭제되기 전까지는 누구든 몇회든 파일을 다운받을 수 있습니다.
        </div>
      </div>
    </div>
  );
}