class MemoryStreamAdapter {
  streamBuffer(buffer, res, { fileName, reportId }) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('X-Report-Id', reportId);
    res.send(buffer);
  }
}

// AzureBlobAdapter stub — Phase 5
class AzureBlobAdapter {
  async save() {
    throw new Error('Azure Blob storage not implemented');
  }
}

function getStorageAdapter() {
  return new MemoryStreamAdapter();
}

module.exports = { MemoryStreamAdapter, AzureBlobAdapter, getStorageAdapter };
