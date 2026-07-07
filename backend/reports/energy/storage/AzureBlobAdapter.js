const { MemoryStreamAdapter } = require('./reportStorageAdapter');

// Phase 5: Azure Blob implementation
class AzureBlobAdapter extends MemoryStreamAdapter {
  async save(buffer, meta) {
    throw new Error('Azure Blob storage is not implemented yet');
  }

  async getUrl(storageKey) {
    throw new Error('Azure Blob storage is not implemented yet');
  }
}

module.exports = { AzureBlobAdapter };
