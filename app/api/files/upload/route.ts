import { NextResponse } from "next/server";
import { cloudinary } from "@/lib/cloudinary";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const folder = (formData.get("folder") as string) || "uploads";

    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key === "file" || key.startsWith("file")) {
        if (value instanceof File) files.push(value);
      }
    }

    if (!files.length) {
      return NextResponse.json(
        { message: "No files provided. Use 'file' field(s) in multipart/form-data." },
        { status: 400 }
      );
    }

    const uploads = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const result = await new Promise<{ url: string; public_id: string }>((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder },
            (error, res) => {
              if (error || !res) return reject(error);
              resolve({ url: res.secure_url, public_id: res.public_id });
            }
          );
          stream.end(buffer);
        });

        return { filename: file.name, ...result };
      })
    );

    return NextResponse.json({ uploads }, { status: 200 });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ message: "Upload failed" }, { status: 500 });
  }
}


