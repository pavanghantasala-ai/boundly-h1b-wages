import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = (await req.json()) as {
      name?: string;
      email?: string;
      password?: string;
    };
    const e = email?.trim().toLowerCase();
    if (!e || !password || password.length < 8) {
      return NextResponse.json(
        { error: "Email and password (min 8 chars) are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email: e } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: e,
        name: name?.trim() || null,
        passwordHash,
      },
      select: { id: true, email: true, name: true },
    });

    return NextResponse.json({ ok: true, user });
  } catch (err) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
