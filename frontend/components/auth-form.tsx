"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, Workflow } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/app/auth-provider";
import { getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AuthMode = "login" | "register";

const credentialsSchema = z.object({
  name: z.string().optional(),
  email: z.string().trim().email("Enter a valid email address").max(254),
  password: z
    .string()
    .min(12, "Use at least 12 characters")
    .max(128, "Password must be 128 characters or fewer"),
});

type AuthValues = z.infer<typeof credentialsSchema>;

export function AuthForm({ mode }: { mode: AuthMode }) {
  const isRegister = mode === "register";
  const router = useRouter();
  const { user, isLoading, signIn, signUp } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const schema = useMemo(
    () =>
      isRegister
        ? credentialsSchema.extend({
            name: z.string().trim().min(2, "Enter your name").max(80),
          })
        : credentialsSchema,
    [isRegister],
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/dashboard");
    }
  }, [isLoading, router, user]);

  async function onSubmit(values: AuthValues) {
    setFormError(null);
    try {
      if (isRegister) {
        await signUp({
          name: values.name ?? "",
          email: values.email,
          password: values.password,
        });
      } else {
        await signIn({ email: values.email, password: values.password });
      }
      router.replace("/dashboard");
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  }

  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-[1fr_0.9fr]">
      <section className="relative hidden overflow-hidden bg-[#102343] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
        <div className="absolute -right-36 -top-32 size-[520px] rounded-full border border-white/[0.08]" />
        <div className="absolute -right-16 -top-12 size-[340px] rounded-full border border-white/[0.08]" />
        <Link href="/" className="relative z-10 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-blue-500">
            <Workflow size={21} />
          </span>
          <span className="text-lg font-semibold">TaskFlow</span>
        </Link>

        <div className="relative z-10 max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs text-blue-100">
            <span className="size-1.5 rounded-full bg-blue-400" />
            A calmer way to move work forward
          </div>
          <h1 className="text-4xl font-semibold leading-[1.14] tracking-tight xl:text-[52px]">
            Make space for
            <br />
            <span className="text-blue-300">meaningful work.</span>
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-7 text-blue-100/75">
            Plan together, keep priorities clear, and see every project make
            progress — one focused task at a time.
          </p>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-medium">This week</span>
              <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] text-emerald-200">
                On track
              </span>
            </div>
            <div className="space-y-3">
              {[
                { label: "Product launch", progress: "78%" },
                { label: "Website refresh", progress: "54%" },
                { label: "Customer research", progress: "91%" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="mb-1.5 flex justify-between text-xs text-blue-50/80">
                    <span>{item.label}</span>
                    <span>{item.progress}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-blue-300"
                      style={{ width: item.progress }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="relative z-10 text-xs text-blue-100/50">
          Thoughtful planning. Better teamwork.
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-[410px]">
          <Link
            href="/"
            className="mb-12 inline-flex items-center gap-2.5 lg:hidden"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-brand text-white">
              <Workflow size={19} />
            </span>
            <span className="text-base font-semibold">TaskFlow</span>
          </Link>

          <div className="mb-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.13em] text-brand">
              {isRegister ? "Start with a clear plan" : "Welcome back"}
            </p>
            <h2 className="text-[30px] font-semibold tracking-tight text-foreground">
              {isRegister ? "Create your account" : "Sign in to TaskFlow"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {isRegister
                ? "Set up your workspace and bring your team along."
                : "Pick up where you and your team left off."}
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            {isRegister ? (
              <div>
                <label
                  className="mb-2 block text-sm font-medium text-foreground"
                  htmlFor="name"
                >
                  Full name
                </label>
                <Input
                  id="name"
                  autoComplete="name"
                  placeholder="Alex Morgan"
                  aria-invalid={Boolean(errors.name)}
                  {...register("name")}
                />
                {errors.name ? (
                  <p className="mt-1.5 text-xs text-danger">
                    {errors.name.message}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div>
              <label
                className="mb-2 block text-sm font-medium text-foreground"
                htmlFor="email"
              >
                Email address
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                aria-invalid={Boolean(errors.email)}
                {...register("email")}
              />
              {errors.email ? (
                <p className="mt-1.5 text-xs text-danger">
                  {errors.email.message}
                </p>
              ) : null}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="password"
                >
                  Password
                </label>
                {!isRegister ? (
                  <span className="text-xs text-muted">
                    Secure account access
                  </span>
                ) : null}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    isRegister ? "new-password" : "current-password"
                  }
                  placeholder={
                    isRegister
                      ? "At least 12 characters"
                      : "Enter your password"
                  }
                  aria-invalid={Boolean(errors.password)}
                  className="pr-12"
                  {...register("password")}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {errors.password ? (
                <p className="mt-1.5 text-xs text-danger">
                  {errors.password.message}
                </p>
              ) : null}
            </div>

            {formError ? (
              <p
                role="alert"
                className="rounded-xl border border-danger/20 bg-danger/5 px-3.5 py-3 text-sm text-danger"
              >
                {formError}
              </p>
            ) : null}

            <Button className="w-full" size="lg" type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Please wait…"
                : isRegister
                  ? "Create account"
                  : "Sign in"}
              {!isSubmitting ? <ArrowRight size={17} /> : null}
            </Button>
          </form>

          <p className="mt-7 text-center text-sm text-muted">
            {isRegister ? "Already have an account?" : "New to TaskFlow?"}{" "}
            <Link
              className="font-semibold text-brand hover:underline"
              href={isRegister ? "/login" : "/register"}
            >
              {isRegister ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <p className="mt-8 text-center text-[11px] leading-5 text-muted">
            By continuing, you agree to use TaskFlow responsibly and keep your
            account credentials private.
          </p>
        </div>
      </section>
    </div>
  );
}
