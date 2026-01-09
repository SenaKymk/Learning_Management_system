"use client";

import { useState } from "react";
import { uploadFile } from "../modules/api";

type FileUploadProps = {
  onUploaded: (objectKey: string) => void;
  accept?: string;
};

export default function FileUpload({ onUploaded, accept }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError("Please select a file");
      return;
    }

    if (accept && file.type !== accept) {
      setError("Only PDF files are allowed");
      return;
    }

    setLoading(true);
    try {
      const result = await uploadFile(file);
      onUploaded(result.objectKey);
      setFile(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
      <input
        type="file"
        accept={accept}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        className="text-sm text-slate-200"
      />
      <button type="submit" className="btn-secondary" disabled={loading}>
        {loading ? "Uploading..." : "Upload material"}
      </button>
      {error ? <span className="text-xs text-rose-300">{error}</span> : null}
    </form>
  );
}
