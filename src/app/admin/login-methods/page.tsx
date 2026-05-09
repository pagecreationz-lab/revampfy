import LoginMethodsAdminClient from "./LoginMethodsAdminClient";

export default function AdminLoginMethodsPage() {
  return (
    <main>
      <h1>Login Methods</h1>
      <p className="hero__subtext">
        Control email/password, email verification code, OTP, and Google sign-in from CMS.
      </p>
      <LoginMethodsAdminClient />
    </main>
  );
}
