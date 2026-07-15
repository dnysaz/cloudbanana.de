import { Globe } from 'lucide-react';
import { getToken } from '../../api';

interface Props {
  winId?: string;
  winData?: Record<string, unknown>;
}

export default function BWeb({ winData }: Props) {
  const filePath = winData?.path as string | undefined;

  const buildSrc = (path: string) => {
    const token = getToken() || '';
    return `/api/v1/files/serve${path}?token=${encodeURIComponent(token)}`;
  };

  const src = filePath ? buildSrc(filePath) : '';

  if (!filePath) {
    return (
      <div className="bweb-empty">
        <Globe size={40} />
        <span>No file specified</span>
      </div>
    );
  }

  return (
    <div className="bweb-container">
      <iframe
        className="bweb-frame"
        src={src}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        title="WebView"
      />
    </div>
  );
}
