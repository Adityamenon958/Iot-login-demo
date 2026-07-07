import axios from 'axios';

export async function generateAndDownloadReport(payload) {
  const response = await axios.post('/api/energy-meter/reports/generate', payload, {
    withCredentials: true,
    responseType: 'blob',
  });

  const reportId = response.headers['x-report-id'];
  const disposition = response.headers['content-disposition'] || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const fileName = match?.[1] || 'energy-report.pdf';

  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);

  return { reportId, fileName };
}

export async function fetchReportHistory(limit = 10) {
  const response = await axios.get('/api/energy-meter/reports/history', {
    params: { limit },
    withCredentials: true,
  });
  return response.data?.data || [];
}
