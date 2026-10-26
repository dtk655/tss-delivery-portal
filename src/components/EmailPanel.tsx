import { useMemo, useState } from 'react';
import { renderRouteEmail } from '../lib/email';
import type { DispatchFlag, RoutePlan } from '../lib/types';

export default function EmailPanel({
  date,
  source,
  routes,
  flags,
  routingNote,
}: {
  date: string;
  source: 'fixture' | 'netsuite';
  routes: RoutePlan[];
  flags: DispatchFlag[];
  routingNote: string;
}) {
  const draft = useMemo(
    () => renderRouteEmail({ date, source, routes, flags, routingNote }),
    [date, source, routes, flags, routingNote],
  );
  const [note, setNote] = useState('');

  async function copy(value: string, kind: string) {
    try {
      if (kind === 'html' && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([draft.html], { type: 'text/html' }),
            'text/plain': new Blob([draft.text], { type: 'text/plain' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(value);
      }
      setNote(kind === 'html' ? 'HTML copied.' : kind === 'text' ? 'Plain text copied.' : 'Subject copied.');
    } catch {
      setNote('Clipboard is blocked in this browser. Download the HTML file instead.');
    }
  }

  function download() {
    const blob = new Blob([draft.html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tss-routes-${date}.html`;
    link.click();
    URL.revokeObjectURL(url);
    setNote('Download started.');
  }

  return (
    <section className="email" id="email">
      <h2>Company email</h2>
      <p className="email-lead">
        Preview of today’s routes for the office. Copy or download the HTML, then send it from your mail client.
      </p>
      <div className="email-bar">
        <p className="subject">{draft.subject}</p>
        <button className="btn quiet" type="button" onClick={() => copy(draft.subject, 'subject')}>
          Copy subject
        </button>
        <button className="btn primary" type="button" onClick={() => copy(draft.html, 'html')}>
          Copy HTML
        </button>
        <button className="btn quiet" type="button" onClick={() => copy(draft.text, 'text')}>
          Copy plain text
        </button>
        <button className="btn quiet" type="button" onClick={download}>
          Download HTML
        </button>
      </div>
      <p className="copy-note" role="status">
        {note}
      </p>
      <iframe className="preview" title="Company route email preview" sandbox="" srcDoc={draft.html} />
    </section>
  );
}
