import { getNoticeStyle, noticeBodyStyle, noticeTitleStyle } from "../styles";

function StatusNotice({ body, title, tone }: { body: string; title: string; tone: "good" | "warn" }) {
  return (
    <section className={getNoticeStyle(tone)}>
      <h3 className={noticeTitleStyle}>{title}</h3>
      <p className={noticeBodyStyle}>{body}</p>
    </section>
  );
}

export default StatusNotice;
