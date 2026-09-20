import { useRef, useState } from "react";
import { Upload, FileText, Film, Image as ImageIcon, X } from "lucide-react";
import api, { mediaUrl } from "../../api/client";
import Button from "./Button";

const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg)$/i;
const VIDEO_RE = /\.(mp4|webm|ogg|mov|m4v)$/i;

/**
 * Uploads a file to the API and hands the stored URL back to the form.
 * Used for profile photos, homework files, activity and event photos,
 * the fee QR code, and Child Mode videos.
 */
export default function FileUpload({ value, onChange, accept, label = "Choose a file", hint }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  async function send(file) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post("/api/uploads", form, { headers: { "Content-Type": "multipart/form-data" } });
      onChange(res.data.url);
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed. Try a smaller file.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const isImage = value && IMAGE_RE.test(value);
  const isVideo = value && VIDEO_RE.test(value);
  const Icon = isVideo ? Film : isImage ? ImageIcon : FileText;

  return (
    <div>
      <div
        className={`uploader ${dragging ? "is-dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          send(e.dataTransfer.files?.[0]);
        }}
      >
        <div className="uploader__preview">
          {isImage ? <img src={mediaUrl(value)} alt="" /> : <Icon size={20} />}
        </div>
        <div className="uploader__body">
          <div className="uploader__name">{value ? value.split("/").pop() : label}</div>
          <div className="uploader__hint">{error || hint || "Drag a file here, or browse"}</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="sm" variant="outline" loading={busy} onClick={() => inputRef.current?.click()}>
            <Upload size={13} /> {value ? "Replace" : "Browse"}
          </Button>
          {value && (
            <Button size="sm" variant="ghost" onClick={() => onChange("")} aria-label="Remove file">
              <X size={14} />
            </Button>
          )}
        </div>
        <input ref={inputRef} type="file" accept={accept} onChange={(e) => send(e.target.files?.[0])} />
      </div>
    </div>
  );
}
