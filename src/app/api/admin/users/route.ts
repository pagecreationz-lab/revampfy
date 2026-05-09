import { NextResponse } from "next/server";
import {
  adminCreateCustomerUser,
  adminDeleteCustomerUser,
  getCustomerUsers,
  updateCustomerPasswordByEmail,
  updateCustomerProfile,
  type PaymentMode,
} from "@/lib/customerData";
import { getRoleAssignments } from "@/lib/roleAssignments";

function sanitizeUsers() {
  return Promise.all([getCustomerUsers(), getRoleAssignments()]).then(([users, assignments]) => {
    const vendorRoleEmails = new Set(
      assignments
        .filter((entry) => entry.role === "vendor_admin")
        .map((entry) => String(entry.email || "").trim().toLowerCase())
    );
    return users
      .filter((user) => !vendorRoleEmails.has(String(user.email || "").trim().toLowerCase()))
      .map(({ passwordHash: _passwordHash, ...user }) => user);
  });
}

export async function GET() {
  try {
    const users = await sanitizeUsers();
    return NextResponse.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load users.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const email = String(payload.email || "").trim().toLowerCase();
    const password = String(payload.password || "");
    const name = String(payload.name || "").trim();
    const mobile = String(payload.mobile || "").trim();
    const address = String(payload.address || "").trim();
    const paymentMode = String(payload.paymentMode || "UPI") as PaymentMode;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "email, password and name are required." },
        { status: 400 }
      );
    }

    const user = await adminCreateCustomerUser({
      email,
      password,
      name,
      mobile,
      address,
      paymentMode,
    });
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return NextResponse.json({ ok: true, user: safeUser });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create user.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const email = String(payload.email || "").trim().toLowerCase();
    const nextEmail = String(payload.nextEmail || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "email is required." }, { status: 400 });
    }
    const updated = await updateCustomerProfile(email, {
      email: nextEmail || undefined,
      name: typeof payload.name === "string" ? payload.name : undefined,
      mobile: typeof payload.mobile === "string" ? payload.mobile : undefined,
      address: typeof payload.address === "string" ? payload.address : undefined,
      paymentMode: payload.paymentMode as PaymentMode,
      needsProfileCompletion:
        typeof payload.needsProfileCompletion === "boolean"
          ? payload.needsProfileCompletion
          : undefined,
    });

    if (typeof payload.password === "string" && payload.password.trim().length >= 6) {
      await updateCustomerPasswordByEmail(updated.email, payload.password.trim());
    }

    const { passwordHash: _passwordHash, ...safeUser } = updated;
    return NextResponse.json({ ok: true, user: safeUser });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update user.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = String(searchParams.get("email") || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "email query param is required." }, { status: 400 });
    }
    await adminDeleteCustomerUser(email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete user.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
