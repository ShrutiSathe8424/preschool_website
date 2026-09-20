import { useEffect, useState } from "react";
import api, { errorMessage, mediaUrl } from "../../api/client";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import { Banner, EmptyState } from "../../components/ui/Feedback";
import { BookOpen, Palette, Paperclip, Download } from "lucide-react";

const IMAGE_RE = /\.(png|jpe?g|gif|webp)$/i;
const today = () => new Date().toISOString().slice(0, 10);

/** Homework and activities, with whatever the teacher attached. */
export default function UpdatesTab({ student, kind }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!student) return;
    setItems(null);
    const path = kind === "homework" ? "homework" : "activities";
    api
      .get(`/api/parent/${path}/${student.student_id}`)
      .then((res) => setItems(res.data))
      .catch((err) => setError(errorMessage(err)));
  }, [student, kind]);

  if (error) return <Banner tone="error">{error}</Banner>;
  if (!items) return <Card><p style={{ color: "var(--color-text-muted)", fontSize: 13.5 }}>Loading…</p></Card>;

  const isHomework = kind === "homework";

  if (!items.length) {
    return (
      <Card>
        <EmptyState
          icon={isHomework ? BookOpen : Palette}
          title={isHomework ? "No homework set" : "No activities shared yet"}
          hint={
            isHomework
              ? `Anything ${student.name}'s teacher assigns will appear here with the worksheet attached.`
              : `Photos from ${student.name}'s day will show up here.`
          }
        />
      </Card>
    );
  }

  return (
    <Card>
      {items.map((item) => {
        const id = isHomework ? item.homework_id : item.activity_id;
        const media = isHomework ? item.file_url : item.photo_url;
        const date = isHomework ? item.due_date : item.act_date;
        const overdue = isHomework && date < today();
        return (
          <div className="list-row" key={id}>
            {media && IMAGE_RE.test(media) ? (
              <img className="list-row__media" src={mediaUrl(media)} alt="" />
            ) : (
              <div className="list-row__media" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-faint)" }}>
                {isHomework ? <BookOpen size={22} /> : <Palette size={22} />}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span className="list-row__title">{item.title}</span>
                {isHomework && <Badge variant={overdue ? "overdue" : "pending"}>{overdue ? "Past due" : `Due ${date}`}</Badge>}
              </div>
              {!isHomework && <div className="list-row__meta">{date}</div>}
              {item.description && <div className="list-row__body">{item.description}</div>}
              {media && (
                <a className="file-link" href={mediaUrl(media)} target="_blank" rel="noreferrer">
                  {IMAGE_RE.test(media) ? <Download size={12} /> : <Paperclip size={12} />}
                  {IMAGE_RE.test(media) ? "Open full size" : media.split("/").pop()}
                </a>
              )}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
