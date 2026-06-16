import React, { useState } from 'react';
import { Card, Button, Accordion } from 'react-bootstrap';
import { Copy, Check } from 'lucide-react';
import styles from './EnergyRawPayloadPanel.module.css';

export default function EnergyRawPayloadPanel({ rawPayload, parseStatus, collapsible = false }) {
  const [copied, setCopied] = useState(false);

  const jsonText = rawPayload != null
    ? JSON.stringify(rawPayload, null, 2)
    : 'No payload available';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const body = (
    <>
      <div className={styles.header}>
        <div>
          <h6 className={styles.title}>Raw Payload</h6>
          <small className="text-muted">As received from meter</small>
        </div>
        <Button variant="outline-secondary" size="sm" onClick={handleCopy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? ' Copied' : ' Copy JSON'}
        </Button>
      </div>
      {parseStatus && (
        <div className={styles.status}>
          parseStatus: <strong>{parseStatus}</strong>
        </div>
      )}
      <pre className={styles.pre}>{jsonText}</pre>
    </>
  );

  if (collapsible) {
    return (
      <Accordion defaultActiveKey="0" className={styles.accordion}>
        <Accordion.Item eventKey="0">
          <Accordion.Header>Raw Payload (as received from meter)</Accordion.Header>
          <Accordion.Body>{body}</Accordion.Body>
        </Accordion.Item>
      </Accordion>
    );
  }

  return <Card className={styles.panel}>{body}</Card>;
}
