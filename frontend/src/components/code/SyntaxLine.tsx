import { tokenizeLine } from "../../lib/syntax";

type Props = {
  text: string;
  language?: string;
};

export function SyntaxLine({ text, language }: Props) {
  return (
    <>
      {tokenizeLine(text, language).map((token, index) => (
        <span key={index} className={`syntax-token ${token.kind}`}>{token.text}</span>
      ))}
    </>
  );
}
