import { cardKickerStyle, cardTextStyle, cardTitleStyle, decisionCardStyle } from "../styles";

function DecisionCard({ body, title }: { body: string; title: string }) {
  return (
    <article className={decisionCardStyle}>
      <p className={cardKickerStyle}>Decision slot</p>
      <h3 className={cardTitleStyle}>{title}</h3>
      <p className={cardTextStyle}>{body}</p>
    </article>
  );
}

export default DecisionCard;
