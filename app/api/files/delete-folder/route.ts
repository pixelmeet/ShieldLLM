import { NextResponse } from "next/server";
import { cloudinary } from "@/lib/cloudinary";

export async function POST(req: Request) {
  try {
    const { folder } = (await req.json()) as { folder?: string };
    if (!folder) {
      return NextResponse.json(
        { message: "folder is required" },
        { status: 400 }
      );
    }

    const resources = await cloudinary.api.resources({
      type: "upload",
      prefix: folder + "/",
      max_results: 500,
    });

    if (resources.resources.length) {
      const publicIds = resources.resources.map((r: { public_id: string }) => r.public_id);
      await cloudinary.api.delete_resources(publicIds);
    }

    const res = await cloudinary.api.delete_folder(folder);
    return NextResponse.json({ result: res }, { status: 200 });
  } catch (err) {
    console.error("Delete folder error:", err);
    return NextResponse.json(
      { message: "Delete folder failed" },
      { status: 500 }
    );
  }
}
