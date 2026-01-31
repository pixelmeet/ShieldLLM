import { NextResponse } from "next/server";
import { cloudinary } from "@/lib/cloudinary";

export async function POST(req: Request) {
  try {
    const { publicId } = (await req.json()) as { publicId?: string };
    if (!publicId) {
      return NextResponse.json({ message: "publicId is required" }, { status: 400 });
    }

    const res = await cloudinary.uploader.destroy(publicId);
    return NextResponse.json({ result: res }, { status: 200 });
  } catch (err) {
    console.error("Delete file error:", err);
    return NextResponse.json({ message: "Delete failed" }, { status: 500 });
  }
}


