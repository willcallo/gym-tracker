// Renders the model's **bold** markers and paragraph breaks without a markdown library.
export default function AiText({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-base leading-relaxed text-gray-900">
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i}>
          {para.split(/\*\*(.+?)\*\*/g).map((part, j) => (j % 2 === 1 ? <strong key={j}>{part}</strong> : part))}
        </p>
      ))}
    </div>
  );
}
