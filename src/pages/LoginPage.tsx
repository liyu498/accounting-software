import { Lock, ShieldCheck, User } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { invoke, isTauri } from "../lib/tauri";
import { useAuthStore } from "../stores/authStore";

type AuthSetupStatus = {
  initialized: boolean;
};

const inputClassName =
  "rounded border-slate-300 pl-10 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [realName, setRealName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(isTauri);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isTauri) {
      setCheckingSetup(false);
      return;
    }

    let active = true;
    void invoke<AuthSetupStatus>("get_auth_setup_status").then(
      (status) => {
        if (!active) return;
        setSetupRequired(!status.initialized);
        setCheckingSetup(false);
      },
      (reason) => {
        if (!active) return;
        setError(`无法读取管理员初始化状态：${String(reason)}`);
        setCheckingSetup(false);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("请输入用户名和密码");
      return;
    }
    if (setupRequired && !realName.trim()) {
      setError("请输入管理员姓名");
      return;
    }
    if (setupRequired && password !== passwordConfirm) {
      setError("两次输入的密码不一致");
      return;
    }

    setIsLoading(true);
    try {
      if (setupRequired) {
        await invoke("initialize_admin", {
          input: {
            username: username.trim(),
            password,
            real_name: realName.trim(),
          },
        });
        setSetupRequired(false);
      }

      const success = await login(username.trim(), password);
      if (success) {
        navigate("/", { replace: true });
      } else {
        setError(useAuthStore.getState().error || "用户名或密码错误");
      }
    } catch (reason) {
      setError(`${setupRequired ? "初始化" : "登录"}失败：${String(reason)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4 text-slate-900 dark:bg-black dark:text-neutral-100">
      <section className="w-full max-w-sm border border-slate-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <header className="border-b border-slate-200 px-6 py-5 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-[#1f65a7] text-lg font-semibold text-white">
              账
            </div>
            <div>
              <h1 className="text-base font-semibold">AI 代理记账</h1>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">
                {setupRequired ? "首次启动安全初始化" : "桌面端身份验证"}
              </p>
            </div>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {setupRequired && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-neutral-300">
                管理员姓名
              </span>
              <div className="relative">
                <ShieldCheck className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  value={realName}
                  onChange={(event) => setRealName(event.target.value)}
                  className={inputClassName}
                  autoComplete="name"
                  disabled={checkingSetup || isLoading}
                />
              </div>
            </label>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-neutral-300">
              用户名
            </span>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className={inputClassName}
                autoComplete="username"
                disabled={checkingSetup || isLoading}
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-neutral-300">
              密码
            </span>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClassName}
                autoComplete={
                  setupRequired ? "new-password" : "current-password"
                }
                disabled={checkingSetup || isLoading}
              />
            </div>
          </label>

          {setupRequired && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-neutral-300">
                确认密码
              </span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  type="password"
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  className={inputClassName}
                  autoComplete="new-password"
                  disabled={checkingSetup || isLoading}
                />
              </div>
              <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-neutral-400">
                至少 12 位，包含大小写字母、数字和符号，且不能包含用户名。
              </p>
            </label>
          )}

          {error && (
            <p
              role="alert"
              className="border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            size="md"
            loading={isLoading}
            disabled={checkingSetup}
            className="w-full rounded bg-[#1f65a7] text-sm dark:bg-blue-600"
          >
            {checkingSetup
              ? "正在检查"
              : setupRequired
                ? "创建管理员并进入系统"
                : "登录"}
          </Button>
        </form>
      </section>
    </main>
  );
}
