interface Props {
  path: string[];
}

export const PathBar: React.FC<Props> = ({ path }) => {
  return (
    <div className="path-bar">
      {path.map((part, i) => (
        <span key={i}>
          {i > 0 && <span className="sep"> › </span>}
          <span className="part">{part}</span>
        </span>
      ))}
    </div>
  );
};
