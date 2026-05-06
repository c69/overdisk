import type { DirNode } from './types';
import { formatSize } from './types';

interface Props {
  node: DirNode;
}

export const StatsPanel: React.FC<Props> = ({ node }) => {
  return (
    <div className="stats-panel">
      <h3>{node.name}</h3>
      <table>
        <tbody>
          <tr>
            <td>Size</td>
            <td>{formatSize(node.size)}</td>
          </tr>
          <tr>
            <td>Files</td>
            <td>{node.fileCount.toLocaleString()}</td>
          </tr>
          <tr>
            <td>Directories</td>
            <td>{node.dirCount.toLocaleString()}</td>
          </tr>
          {node.children && (
            <tr>
              <td>Children</td>
              <td>{node.children.length.toLocaleString()}</td>
            </tr>
          )}
        </tbody>
      </table>
      {node.children && node.children.length > 0 && (
        <>
          <h4>Largest</h4>
          <ul className="top-list">
            {node.children.slice(0, 8).map((child) => (
              <li key={child.name}>
                <span className="top-name">{child.name}</span>
                <span className="top-size">{formatSize(child.size)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};
