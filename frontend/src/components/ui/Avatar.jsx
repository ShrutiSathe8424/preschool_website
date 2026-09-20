import { mediaUrl } from "../../api/client";

function initials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export default function Avatar({ name, src, size = 38, style }) {
  const dimension = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  return (
    <div className="avatar" style={{ ...dimension, ...style }}>
      {src ? <img src={mediaUrl(src)} alt="" /> : initials(name)}
    </div>
  );
}
