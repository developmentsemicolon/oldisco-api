export interface UploadFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

export async function toUploadFile(file: File): Promise<UploadFile> {
  return {
    buffer: Buffer.from(await file.arrayBuffer()),
    mimetype: file.type,
    size: file.size,
    originalname: file.name,
  };
}

export async function toUploadFiles(files: File | File[] | undefined): Promise<UploadFile[]> {
  if (!files) return [];
  const list = Array.isArray(files) ? files : [files];
  return Promise.all(list.map(toUploadFile));
}
