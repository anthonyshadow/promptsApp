import { emptyStateStyle, noticeBodyStyle, noticeTitleStyle } from "../styles";

function EmptyState({ body, title }: { body: string; title: string }) {
  return (
    <section className={emptyStateStyle}>
      <h3 className={noticeTitleStyle}>{title}</h3>
      <p className={noticeBodyStyle}>{body}</p>
    </section>
  );
}

export default EmptyState;
