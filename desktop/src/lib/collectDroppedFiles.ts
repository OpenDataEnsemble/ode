/**
 * Expand a DataTransfer from drag-and-drop into a flat File[].
 * When the user drops a folder (supported in Chromium / WebView2), walks the
 * directory tree recursively. Otherwise falls back to `dataTransfer.files`.
 */

function fileFromEntry(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

async function readDirectoryRecursive(
  dir: FileSystemDirectoryEntry,
): Promise<File[]> {
  const out: File[] = [];
  const reader = dir.createReader();

  const readBatch = (): Promise<FileSystemEntry[]> =>
    new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });

  let batch: FileSystemEntry[];
  do {
    batch = await readBatch();
    for (const entry of batch) {
      if (entry.isFile) {
        out.push(await fileFromEntry(entry as FileSystemFileEntry));
      } else if (entry.isDirectory) {
        out.push(
          ...(await readDirectoryRecursive(entry as FileSystemDirectoryEntry)),
        );
      }
    }
  } while (batch.length > 0);

  return out;
}

function getEntryFromItem(
  item: DataTransferItem,
): FileSystemEntry | null {
  const w = item as DataTransferItem & {
    webkitGetAsEntry?: () => FileSystemEntry | null;
  };
  return w.webkitGetAsEntry?.() ?? null;
}

/**
 * Collects every file from a drop, including nested files inside dropped folders.
 */
export async function collectFilesFromDataTransfer(
  dt: DataTransfer,
): Promise<File[]> {
  const items = dt.items;
  if (!items?.length) {
    return Array.from(dt.files);
  }

  const probe = items[0] as DataTransferItem & {
    webkitGetAsEntry?: () => FileSystemEntry | null;
  };
  if (typeof probe.webkitGetAsEntry !== 'function') {
    return Array.from(dt.files);
  }

  const collected: File[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind !== 'file') {
      continue;
    }
    const entry = getEntryFromItem(item);
    if (!entry) {
      const f = item.getAsFile();
      if (f) {
        collected.push(f);
      }
      continue;
    }
    if (entry.isFile) {
      collected.push(await fileFromEntry(entry as FileSystemFileEntry));
    } else if (entry.isDirectory) {
      collected.push(
        ...(await readDirectoryRecursive(entry as FileSystemDirectoryEntry)),
      );
    }
  }

  if (collected.length === 0 && dt.files.length > 0) {
    return Array.from(dt.files);
  }
  return collected;
}
