"use client";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  Code2,
  Database,
  ExternalLink,
  FileCheck2,
  FileText,
  FlaskConical,
  History,
  Layers3,
  Link2,
  LoaderCircle,
  PanelLeftClose,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  SquareArrowOutUpRight,
  X,
} from "lucide-react";

type Claim = {
  id: string;
  text: string;
  metric: string;
  kind: string;
  verdict: string;
  reason: string;
  evidence_ids: string[];
  review: string;
  review_note: string;
  operator: string;
  threshold: number | null;
  note?: string;
};
type Evidence = {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  formula: string;
  source_ids: string[];
  fields: string[];
  quality: string;
  reason: string;
};
type Run = {
  id: string;
  mode: string;
  created_at: string;
  input: { text: string; symbol: string; window: number };
  claims: Claim[];
  evidence: Evidence[];
  sources: any[];
  warnings: string[];
  corroboration: { status: string; message: string };
  period: any;
  series: any[];
  review_log: any[];
  model_record: any;
  planning_note?: string;
  plan: any;
};
const EXAMPLE =
  "贵州茅台近5个交易日跑赢沪深300。末日成交额高于窗口前序日均。市盈率TTM低于25倍。这可能与政策催化有关。";
const LABELS: Record<string, string> = {
  supported: "证据支持",
  contradicted: "证据不支持",
  unknown: "尚无法判断",
  pending: "待复核",
  confirmed: "已确认",
  revision: "需修订",
  valid: "可用",
  missing: "缺失",
  stale: "过期",
  conflict: "冲突",
  invalid: "口径不适用",
};
const METRIC: Record<string, string> = {
  return: "区间涨跌幅",
  relative_return: "相对沪深 300",
  turnover_ratio: "成交额比",
  pe_ttm: "市盈率 TTM",
  price_change: "当日涨跌幅",
  causality: "因果解释",
  unsupported: "超出当前工具范围",
};
const fmt = (n: number | null, d = 2) =>
  n === null || !Number.isFinite(n) ? "—" : n.toFixed(d);
const time = (v: any) => {
  if (!v) return "时点未知";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? String(v)
    : new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(d);
};
const fullTime = (v: any) =>
  v
    ? new Date(v).toLocaleString("zh-CN", {
        timeZone: "Asia/Shanghai",
        hour12: false,
      })
    : "未知";
async function api(path: string, body?: any) {
  const res = await fetch(
    path,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {},
  );
  const json: any = await res.json();
  if (!res.ok || json.ok === false)
    throw new Error(json.error || "服务暂不可用");
  return json;
}
function Sparkline({ rows }: { rows: any[] }) {
  if (rows.length < 2)
    return <div className="chart-empty">日线不足，无法绘制</div>;
  const vals = rows.map((x) => x.close_price);
  const lo = Math.min(...vals),
    hi = Math.max(...vals);
  const pts = vals
    .map(
      (v, i) =>
        `${20 + (i / (vals.length - 1)) * 540},${112 - ((v - lo) / (hi - lo || 1)) * 86}`,
    )
    .join(" ");
  return (
    <svg
      viewBox="0 0 580 135"
      className="sparkline"
      role="img"
      aria-label="选定窗口内前复权收盘价走势"
    >
      <defs>
        <linearGradient id="shade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#168a69" stopOpacity=".13" />
          <stop offset="100%" stopColor="#168a69" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[30, 70, 110].map((y) => (
        <line
          key={y}
          x1="0"
          x2="580"
          y1={y}
          y2={y}
          stroke="#e9eeed"
          strokeDasharray="4 5"
        />
      ))}
      <polygon points={`20,130 ${pts} 560,130`} fill="url(#shade)" />
      <polyline
        points={pts}
        fill="none"
        stroke="#198a6c"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle
        cx="560"
        cy={pts.split(" ").at(-1)?.split(",")[1]}
        r="4"
        fill="#198a6c"
      />
    </svg>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1500);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{shown}</>;
}
export default function Home() {
  const [screen, setScreen] = useState("home");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [tab, setTab] = useState("work");
  const [text, setText] = useState(EXAMPLE);
  const [symbol, setSymbol] = useState("600519.SH");
  const [windowDays, setWindowDays] = useState(5);
  const [run, setRun] = useState<Run | null>(null);
  const [plan, setPlan] = useState<any>(null);
  const [ticket, setTicket] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [status, setStatus] = useState<any>({});
  const [settings, setSettings] = useState(false);
  const [drawer, setDrawer] = useState<Evidence | null>(null);
  const [activeSource, setActiveSource] = useState("");
  const [llm, setLlm] = useState({
    baseUrl: "https://api.openai.com/v1",
    model: "",
    apiKey: "",
  });
  const [filter, setFilter] = useState("all");
  const [history, setHistory] = useState<Run[]>([]);
  const [search, setSearch] = useState("");
  const [lab, setLab] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const resultsRef = useRef<HTMLDivElement>(null);
  const openDesk = (view = "work") => {
    setTab(view);
    setScreen("desk");
    setMobileMenu(false);
  };
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (settings) setSettings(false);
        else if (drawer) setDrawer(null);
        else if (mobileMenu) setMobileMenu(false);
        else setScreen("home");
      }
    };
    const resize = () => {
      if (window.innerWidth > 720) setMobileMenu(false);
    };
    window.addEventListener("keydown", close);
    window.addEventListener("resize", resize);
    document.body.classList.toggle("menu-open", mobileMenu);
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("resize", resize);
      document.body.classList.remove("menu-open");
    };
  }, [settings, drawer, mobileMenu]);
  useEffect(() => {
    api("/api/status")
      .then(setStatus)
      .catch(() => {});
    api("/api/sample")
      .then((j) => setRun(j.run as Run))
      .catch(() => setError("示例暂不可用；可创建在线任务"))
      .finally(() => setInitialLoading(false));
    try {
      const saved = JSON.parse(localStorage.getItem("zhengyan-runs") || "[]");
      if (Array.isArray(saved)) setHistory(saved);
    } catch {}
  }, []);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 2800);
      return () => clearTimeout(id);
    }
  }, [toast]);
  function persist(next: Run) {
    setRun(next);
    setHistory((old) => {
      const h = [next, ...old.filter((r) => r.id !== next.id)].slice(0, 8);
      try {
        localStorage.setItem("zhengyan-runs", JSON.stringify(h));
      } catch {
        setToast("浏览器存储空间不足，当前结果仍可导出");
      }
      return h;
    });
  }
  const input = { text, symbol, window: windowDays };
  async function start() {
    setError("");
    setPlan(null);
    setBusy("plan");
    try {
      const j = await api("/api/plan", { input, llm });
      setPlan(j.plan);
      setTicket(j.ticket || "");
    } catch (e: any) {
      setError(e.message);
      if (e.message.includes("模型未配置")) setSettings(true);
    } finally {
      setBusy("");
    }
  }
  async function verify(sample = false) {
    setError("");
    setBusy("verify");
    setLab("");
    try {
      const j = await api(
        "/api/verify",
        sample ? { sample_only: true } : { input, plan, ticket },
      );
      persist(j.run);
      if (sample) {
        setText(j.run.input.text);
        setSymbol(j.run.input.symbol);
        setWindowDays(j.run.input.window);
      }
      setPlan(null);
      setTab("work");
      setFilter("all");
      setTimeout(
        () =>
          resultsRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        100,
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function loadSample() {
    setBusy("sample");
    setError("");
    try {
      const j = await api("/api/sample");
      setRun(j.run);
      setText(j.run.input.text);
      setSymbol(j.run.input.symbol);
      setWindowDays(j.run.input.window);
      setPlan(null);
      setTab("work");
      setFilter("all");
      setLab("");
      setToast("已载入真实数据回放；未发起在线查询");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  function newTask() {
    setText("");
    setPlan(null);
    setRun(null);
    setError("");
    setLab("");
    setTab("work");
  }
  function review(id: string, reviewValue: string, note?: string) {
    if (!run) return;
    const next = {
      ...run,
      claims: run.claims.map((c) =>
        c.id === id
          ? {
              ...c,
              review: reviewValue,
              review_note: note === undefined ? c.review_note : note,
            }
          : c,
      ),
      review_log: [
        ...run.review_log,
        {
          claim_id: id,
          action: reviewValue,
          note: note || "",
          at: new Date().toISOString(),
          actor: "本地研究员（未认证身份）",
        },
      ],
    };
    persist(next);
  }
  function updateNote(id: string, note: string) {
    if (!run) return;
    persist({
      ...run,
      claims: run.claims.map((c) =>
        c.id === id ? { ...c, review_note: note } : c,
      ),
    });
  }
  function exportRun(json = false) {
    if (!run) return;
    const pending = run.claims.filter((c) => c.review === "pending").length;
    const type =
      pending || run.claims.some((c) => c.review === "revision")
        ? "待复核草稿"
        : "已完成逐条复核 · 研究记录";
    const content = json
      ? JSON.stringify(
          { ...run, exported_at: new Date().toISOString(), export_label: type },
          null,
          2,
        )
      : `# 证研研究核验记录\n\n状态：${type}\n任务：${run.id}\n模式：${run.mode}\n生成时间：${fullTime(run.created_at)}（Asia/Shanghai）\n证券：${run.input.symbol}\n窗口：${run.period.start}–${run.period.end}，${run.input.window} 个交易日区间\n\n## 待核验观点\n${run.input.text}\n\n## 主张与人工复核\n${run.claims.map((c) => `### ${c.id} ${c.text}\n类型：${c.kind}；结论：${LABELS[c.verdict]}；人工：${LABELS[c.review]}\n${c.reason}\n证据：${c.evidence_ids.join(", ") || "无"}\n备注：${c.review_note || "无"}\n`).join("\n")}\n## 字段级证据\n${run.evidence.map((e) => `- [${e.id}] ${e.label}：${fmt(e.value)} ${e.unit}；质量：${LABELS[e.quality]}\n  口径：${e.formula}\n  原始字段：${e.fields.join(", ")}\n  源：${e.source_ids.join(", ")}\n  ${e.reason}`).join("\n")}\n\n## 数据来源与时点\n${run.sources.map((s) => `- ${s.provider} / ${s.label}：${s.url}\n  抓取时间：${s.fetched_at}；数据时点：${s.data_at ?? "未知"}；request_id：${s.request_id || "未提供"}；状态：${s.ok ? "成功" : s.error}`).join("\n")}\n\n## 风险与缺口\n${run.warnings.map((w) => "- " + w).join("\n")}\n因果主张未经验证；本记录不构成投资建议，不预测涨跌，不承诺收益。JSON 导出包含原始字段与复核日志。\n`;
    const blob = new Blob([content], {
      type: json ? "application/json" : "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `证研-${run.id}.${json ? "json" : "md"}`;
    a.click();
    URL.revokeObjectURL(url);
    setToast(pending ? "已导出，明确标记为待复核草稿" : "已导出研究核验记录");
  }
  function fault(kind: string) {
    if (!run) return;
    const copy = structuredClone(run);
    copy.id = "simulation-" + Date.now();
    copy.mode = "simulation";
    copy.review_log = [];
    copy.claims = copy.claims.map((c) => ({
      ...c,
      review: "pending",
      review_note: "",
    }));
    if (kind === "missing") {
      copy.evidence = copy.evidence.map((e) =>
        e.id === "E2"
          ? {
              ...e,
              value: null,
              quality: "missing",
              reason: "故障注入：指数接口超时，拒绝计算相对涨跌幅。",
            }
          : e,
      );
      copy.claims = copy.claims.map((c) =>
        c.metric === "relative_return"
          ? {
              ...c,
              verdict: "unknown",
              reason: "指数接口失败，无法计算；不沿用上次结果。",
            }
          : c,
      );
      copy.sources = copy.sources.map((s) =>
        s.id === "benchmark"
          ? { ...s, ok: false, error: "故障注入：HTTP 504", raw: undefined }
          : s,
      );
      copy.warnings.push("故障演练：指数接口失败，相对表现主张降为未知。");
    }
    if (kind === "conflict") {
      copy.corroboration = {
        status: "conflict",
        message: "故障注入：两源报价差异超过 0.1%；需要人工查明时点与口径。",
      };
      copy.evidence = copy.evidence.map((e) =>
        ["E5", "E6"].includes(e.id)
          ? { ...e, quality: "conflict", reason: copy.corroboration.message }
          : e,
      );
      copy.claims = copy.claims.map((c) =>
        c.metric === "price_change"
          ? { ...c, verdict: "unknown", reason: copy.corroboration.message }
          : c,
      );
      copy.warnings.push(copy.corroboration.message);
    }
    if (kind === "stale") {
      copy.evidence = copy.evidence.map((e) => ({
        ...e,
        quality: "stale",
        reason: "故障注入：数据时点已落后于应有交易日。",
      }));
      copy.claims = copy.claims.map((c) => ({
        ...c,
        verdict: "unknown",
        reason: "证据已过期，不保留正常结论。",
      }));
      copy.warnings.push("故障演练：所有证据过期，所有主张降为未知。");
    }
    setRun(copy);
    setLab(kind);
    setTab("work");
    setToast("已进入故障演练：使用人工注入数据，不代表真实市场");
  }
  const supported =
      run?.claims.filter((c) => c.verdict === "supported").length || 0,
    contradicted =
      run?.claims.filter((c) => c.verdict === "contradicted").length || 0,
    unknown = run?.claims.filter((c) => c.verdict === "unknown").length || 0,
    reviewed = run?.claims.filter((c) => c.review !== "pending").length || 0;
  const filtered =
    run?.claims.filter((c) => filter === "all" || c.verdict === filter) || [];
  const openEvidence = (e: Evidence) => {
    setDrawer(e);
    setActiveSource(e.source_ids[0] || "");
  };
  return (
    <div className={"experience " + (screen === "desk" ? "desk-open" : "")}>
      <div className="bg" aria-hidden="true">
        <video
          className="bg-video"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        >
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4"
            type="video/mp4"
          />
        </video>
        <div className="video-shade" />
      </div>
      <div
        className="landing-page"
        aria-hidden={screen === "desk" || settings || mobileMenu}
        inert={screen === "desk" || settings || mobileMenu}
      >
        <header className="cinema-header">
          <button
            className="cinema-logo"
            onClick={() => setScreen("home")}
            aria-label="证研首页"
          >
            <Layers3 size={27} />
          </button>
          <nav className="cinema-nav" aria-label="首页导航">
            <button className="current" onClick={() => setScreen("home")}>
              概览
            </button>
            <button onClick={() => openDesk("work")}>观点核验</button>
            <button onClick={() => openDesk("history")}>核验记录</button>
            <button onClick={() => openDesk("method")}>方法与边界</button>
          </nav>
          <button className="cinema-settings" onClick={() => setSettings(true)}>
            连接设置
            <ArrowUpRight size={15} />
          </button>
          <button
            className={"menu-toggle " + (mobileMenu ? "open" : "")}
            onClick={() => setMobileMenu((v) => !v)}
            aria-label={mobileMenu ? "关闭菜单" : "打开菜单"}
            aria-expanded={mobileMenu}
          >
            <span />
            <span />
            <span />
          </button>
        </header>
        <section className="cinema-hero">
          <div className="trust-row anim" style={{ "--d": "0.05s" } as any}>
            <div className="trust-avatar a1">
              <span>扶</span>
            </div>
            <div className="trust-avatar a2">
              <span className="ifind-mark">iF</span>
            </div>
            <div className="trust-avatar a3">
              <span>
                <ShieldCheck size={17} />
              </span>
            </div>
            <div className="trust-pill">扶摇 × iFinD · 证据可追溯</div>
          </div>
          <h1 className="headline">
            <span>把判断，</span>
            <span>交给证据。</span>
          </h1>
          <p className="cinema-subhead anim" style={{ "--d": "0.28s" } as any}>
            拆开一段观点，
            <br className="mobile-break" />
            留下每一步判断的依据。
          </p>
          <div className="cinema-actions anim" style={{ "--d": "0.4s" } as any}>
            <button className="cinema-cta" onClick={() => openDesk("work")}>
              开始核验
              <ArrowRight size={17} />
            </button>
            <button
              className="cinema-secondary"
              onClick={() => {
                openDesk("work");
                loadSample();
              }}
            >
              体验真实数据样例
              <ArrowUpRight size={15} />
            </button>
          </div>
        </section>
        <footer className="cinema-footer">
          <div className="stats-context">
            {run
              ? run.mode === "replay"
                ? "样例核验 · 非实时行情"
                : run.mode === "simulation"
                  ? "故障演练 · 人工注入"
                  : "最近一次核验"
              : "等待核验"}
            <span>不构成投资建议</span>
          </div>
          <div className="cinema-stats">
            {[
              { icon: "+", value: supported, label: "证据支持" },
              { icon: "×", value: contradicted, label: "证据不支持" },
              { icon: "?", value: unknown, label: "尚无法判断" },
              { icon: "#", value: reviewed, label: "人工复核" },
            ].map((stat, i) => (
              <div
                className="cinema-stat anim"
                key={stat.label}
                style={{ "--d": `${0.5 + i * 0.08}s` } as any}
              >
                <span className="stat-glyph">{stat.icon}</span>
                <strong>
                  {run ? <AnimatedNumber value={stat.value} /> : <span>—</span>}
                  {run && <small> / {run.claims.length}</small>}
                </strong>
                <span className="stat-label">{stat.label}</span>
              </div>
            ))}
          </div>
        </footer>
      </div>
      {mobileMenu && (
        <div className="mobile-overlay" onClick={() => setMobileMenu(false)}>
          <div
            className="mobile-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="导航菜单"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="mobile-menu-close"
              onClick={() => setMobileMenu(false)}
              aria-label="关闭菜单"
            >
              <X size={22} />
            </button>
            <button
              className="current"
              onClick={() => {
                setScreen("home");
                setMobileMenu(false);
              }}
            >
              概览
            </button>
            <button onClick={() => openDesk("work")}>观点核验</button>
            <button onClick={() => openDesk("history")}>核验记录</button>
            <button onClick={() => openDesk("method")}>方法与边界</button>
            <button
              className="mobile-settings"
              onClick={() => {
                setMobileMenu(false);
                setSettings(true);
              }}
            >
              连接设置
            </button>
          </div>
        </div>
      )}
      <div
        className="desk-layer"
        hidden={screen !== "desk"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="desk-title"
      >
        <div className="app-shell">
          <aside className="sidebar">
            <a
              className="brand"
              href="/"
              onClick={(e) => {
                e.preventDefault();
                setScreen("home");
              }}
              aria-label="证研首页"
            >
              <span className="brand-mark">
                <Layers3 size={23} />
              </span>
              <span>
                证研<span className="brand-en">RESEARCH DESK</span>
              </span>
            </a>
            <div className="workspace-switch">
              <span className="workspace-dot">R</span>
              <div>投研工作空间</div>
              <ChevronDown size={14} />
            </div>
            <div className="nav-label">工作台</div>
            <nav aria-label="主导航">
              <button
                className={tab === "work" ? "nav-item active" : "nav-item"}
                onClick={() => setTab("work")}
              >
                <FileCheck2 size={19} />
                观点核验<span className="nav-count">01</span>
              </button>
              <button
                className={tab === "history" ? "nav-item active" : "nav-item"}
                onClick={() => setTab("history")}
              >
                <History size={19} />
                核验记录
                <span className="nav-count">
                  {history.length.toString().padStart(2, "0")}
                </span>
              </button>
              <button
                className={tab === "method" ? "nav-item active" : "nav-item"}
                onClick={() => setTab("method")}
              >
                <BookOpen size={19} />
                方法与边界
              </button>
            </nav>
            <div className="sidebar-divider" />
            <div className="nav-label">工具与资源</div>
            <button className="nav-item" onClick={() => setSettings(true)}>
              <Settings2 size={18} />
              连接设置
            </button>
            <a
              className="nav-item"
              href="https://fuyao.aicubes.cn/docs/"
              target="_blank"
              rel="noreferrer"
            >
              <Database size={18} />
              数据文档
              <ExternalLink size={13} />
            </a>
            <div className="sidebar-note">
              <ShieldCheck size={21} />
              <strong>证据先行，判断留痕</strong>
            </div>
            <div className="sidebar-bottom">
              <span className="avatar">研</span>
              <div>研究员</div>
              <button title="连接设置" onClick={() => setSettings(true)}>
                <Settings2 size={17} />
              </button>
            </div>
          </aside>
          <div className="main-shell">
            <header className="topbar">
              <div>
                <PanelLeftClose size={17} />
                <span className="crumb-divider">/</span>研究工作台
                <ChevronRight size={14} />
                <strong id="desk-title">
                  {tab === "work"
                    ? "观点核验"
                    : tab === "history"
                      ? "核验记录"
                      : "方法与边界"}
                </strong>
              </div>
              <div className="topbar-right">
                <button
                  className="return-home"
                  onClick={() => setScreen("home")}
                >
                  <X size={16} />
                  返回首页
                </button>
                <button onClick={() => setSettings(true)}>
                  <Activity size={16} />
                  连接状态
                </button>
                <span className="avatar small">研</span>
              </div>
            </header>
            <main>
              {tab === "work" && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">
                        <span />
                        研究，始于求证
                      </div>
                      <h1>
                        把判断，<span>交给证据。</span>
                      </h1>
                      <p>拆开一段观点，留下每一步判断的依据。</p>
                    </div>
                    <button className="btn btn-light" onClick={newTask}>
                      <Plus size={17} />
                      新建核验
                    </button>
                  </div>
                  <section className="compose-card">
                    <div className="section-title">
                      <span className="icon-square">
                        <Sparkles size={18} />
                      </span>
                      <h2>从一段观点开始</h2>
                      <span className="tag subtle">AI 辅助核验</span>
                    </div>
                    <label className="sr-only" htmlFor="claim-text">
                      待核验观点
                    </label>
                    <textarea
                      id="claim-text"
                      value={text}
                      onChange={(e) => {
                        setText(e.target.value);
                        setPlan(null);
                        setError("");
                      }}
                      maxLength={1600}
                      placeholder="粘贴一段研究观点，例如：贵州茅台近 5 个交易日跑赢沪深 300，市盈率 TTM 低于 25 倍。"
                    />
                    <div className="compose-toolbar">
                      <div className="scope-controls">
                        <label>
                          <select
                            aria-label="研究标的"
                            value={symbol}
                            onChange={(e) => {
                              setSymbol(e.target.value);
                              setPlan(null);
                            }}
                          >
                            <option value="600519.SH">
                              贵州茅台 · 600519.SH
                            </option>
                            <option value="300750.SZ">
                              宁德时代 · 300750.SZ
                            </option>
                            <option value="002594.SZ">
                              比亚迪 · 002594.SZ
                            </option>
                            <option value="600036.SH">
                              招商银行 · 600036.SH
                            </option>
                            <option value="000001.SZ">
                              平安银行 · 000001.SZ
                            </option>
                          </select>
                        </label>
                        <label>
                          <select
                            aria-label="核验窗口"
                            value={windowDays}
                            onChange={(e) => {
                              setWindowDays(Number(e.target.value));
                              setPlan(null);
                            }}
                          >
                            {[5, 10, 20].map((n) => (
                              <option key={n} value={n}>
                                近 {n} 个交易日
                              </option>
                            ))}
                          </select>
                        </label>
                        <span className="benchmark">
                          基准 · <b>沪深 300</b>
                        </span>
                      </div>
                      <button
                        className="btn btn-primary"
                        disabled={!!busy || !text.trim()}
                        onClick={start}
                      >
                        {busy === "plan" ? (
                          <LoaderCircle className="spin" size={17} />
                        ) : (
                          <Sparkles size={17} />
                        )}{" "}
                        {busy === "plan" ? "正在拆解…" : "拆解观点"}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                    <div className="example-row">
                      <span>快速体验</span>
                      <button disabled={!!busy} onClick={loadSample}>
                        真实数据回放
                        <ArrowUpRight size={13} />
                      </button>
                      <span className="tiny-separator" />
                      <button disabled={!!busy} onClick={() => verify(true)}>
                        刷新示例证据
                        <ArrowUpRight size={13} />
                      </button>
                    </div>
                  </section>
                  <div className="workflow-strip">
                    {[
                      {
                        n: "01",
                        title: "观点拆解",
                        detail: "LLM 生成核验计划",
                      },
                      {
                        n: "02",
                        title: "确认与取证",
                        detail: "白名单工具 · 原始字段",
                      },
                      {
                        n: "03",
                        title: "逐条复核",
                        detail: "支持 / 不支持 / 未知",
                      },
                      {
                        n: "04",
                        title: "留痕与导出",
                        detail: "带来源的研究记录",
                      },
                    ].map((s, i) => (
                      <div className="workflow-step" key={s.n}>
                        <span
                          className={
                            "step-no " +
                            (busy && i === (busy === "plan" ? 0 : 1)
                              ? "step-current"
                              : "")
                          }
                        >
                          {busy && i === (busy === "plan" ? 0 : 1) ? (
                            <LoaderCircle size={13} className="spin" />
                          ) : (
                            s.n
                          )}
                        </span>
                        <div>
                          <strong>{s.title}</strong>
                        </div>
                        {i < 3 && <ChevronRight size={15} />}
                      </div>
                    ))}
                  </div>
                  {error && (
                    <div className="error-banner" role="alert">
                      <CircleAlert size={18} />
                      <div>
                        <strong>流程已停止</strong>
                        <p>{error}</p>
                      </div>
                      <button
                        onClick={() => setError("")}
                        aria-label="关闭错误"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                  {busy === "verify" && (
                    <div className="loading-banner" role="status">
                      <LoaderCircle size={20} className="spin" />
                      <div>
                        <strong>正在核对数据与证据</strong>
                        <p>预计需要 15–45 秒，调用异常会明确标记。</p>
                      </div>
                    </div>
                  )}
                  {plan && (
                    <section className="plan-card">
                      <div className="section-title">
                        <span className="icon-square">
                          <CheckCheck size={19} />
                        </span>
                        <h2>先确认，再取证</h2>
                        <span className="tag green">
                          AI 已拆解 {plan.claims.length} 条
                        </span>
                      </div>
                      <p className="muted">
                        确认以下主张和核验条件，再开始取证。
                      </p>
                      <div className="plan-list">
                        {plan.claims.map((c: Claim) => (
                          <div key={c.id}>
                            <span className="claim-id">{c.id}</span>
                            <strong>{c.text}</strong>
                            <span>{METRIC[c.metric]}</span>
                            <code>
                              {c.operator === "unknown"
                                ? "待澄清"
                                : `${c.operator} ${c.threshold}`}
                            </code>
                            <small>{c.note}</small>
                          </div>
                        ))}
                      </div>
                      <div className="plan-footer">
                        <span>
                          <ShieldCheck size={15} />
                          仅查询数据，不执行交易
                        </span>
                        <button
                          className="btn btn-primary"
                          disabled={!!busy}
                          onClick={() => verify()}
                        >
                          <Check size={16} />
                          确认计划并取证
                        </button>
                      </div>
                    </section>
                  )}
                  {initialLoading && (
                    <div className="empty-state">
                      <LoaderCircle className="spin" />
                      正在载入取证样例…
                    </div>
                  )}
                  {run && (
                    <div ref={resultsRef} className="results">
                      <div className="results-heading">
                        <div className="section-title">
                          <h2>核验结果</h2>
                          <span
                            className={
                              "tag " +
                              (["live", "live_fixed"].includes(run.mode)
                                ? "green"
                                : run.mode === "simulation"
                                  ? "amber"
                                  : "subtle")
                            }
                          >
                            {run.mode === "live"
                              ? "AI 规划 · 在线取证"
                              : run.mode === "live_fixed"
                                ? "固定规划 · 在线取证"
                                : run.mode === "simulation"
                                  ? "故障演练 · 人工注入"
                                  : "真实数据回放"}
                          </span>
                          <span className="result-symbol">
                            {run.input.symbol}
                          </span>
                        </div>
                        <div>
                          <span className="muted">
                            取证 {time(run.created_at)} CST
                          </span>
                          <button
                            className="btn btn-light btn-small"
                            onClick={() => exportRun()}
                          >
                            <ArrowDownToLine size={15} />
                            导出记录
                          </button>
                        </div>
                      </div>
                      {run.mode !== "live" && (
                        <div
                          className={
                            "mode-notice " +
                            (run.mode === "simulation" ? "simulation" : "")
                          }
                        >
                          <Clock3 size={15} />
                          {run.mode === "simulation"
                            ? "故障演练：使用人工注入的数据。"
                            : run.mode === "live_fixed"
                              ? "实时数据 · 固定示例规划，未调用 AI。"
                              : `示例回放 · ${fullTime(run.created_at)} CST · 非实时数据，使用预设规划。`}
                          {run.mode === "simulation" && (
                            <button onClick={loadSample}>恢复真实样例</button>
                          )}
                        </div>
                      )}
                      <div className="metric-grid">
                        <div className="metric-card">
                          <div>
                            <span className="metric-icon green">
                              <Check size={17} />
                            </span>
                            <span>证据支持</span>
                            <ArrowUpRight size={14} />
                          </div>
                          <strong>
                            {supported}
                            <small> / {run.claims.length}</small>
                          </strong>
                        </div>
                        <div className="metric-card">
                          <div>
                            <span className="metric-icon rose">
                              <X size={17} />
                            </span>
                            <span>证据不支持</span>
                            <span />
                          </div>
                          <strong>
                            {contradicted}
                            <small> 条主张</small>
                          </strong>
                        </div>
                        <div className="metric-card">
                          <div>
                            <span className="metric-icon amber">
                              <CircleAlert size={17} />
                            </span>
                            <span>尚无法判断</span>
                            <span />
                          </div>
                          <strong>
                            {unknown}
                            <small> 条主张</small>
                          </strong>
                        </div>
                        <div className="metric-card review-metric">
                          <div>
                            <span className="metric-icon blue">
                              <FileCheck2 size={17} />
                            </span>
                            <span>人工复核</span>
                            <span />
                          </div>
                          <strong>
                            {reviewed}
                            <small> / {run.claims.length}</small>
                          </strong>
                          <div className="progress-track">
                            <span
                              style={{
                                width: `${(reviewed / run.claims.length) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="result-columns">
                        <section className="claims-panel">
                          <div className="panel-heading">
                            <h3>
                              主张与证据<span>{run.claims.length}</span>
                            </h3>
                          </div>
                          <div className="filter-tabs">
                            {[
                              ["all", "全部"],
                              ["supported", "支持"],
                              ["contradicted", "不支持"],
                              ["unknown", "未知"],
                            ].map(([value, label]) => (
                              <button
                                key={value}
                                className={filter === value ? "selected" : ""}
                                onClick={() => setFilter(value)}
                              >
                                {label}
                                {value === "all" && (
                                  <span>{run.claims.length}</span>
                                )}
                              </button>
                            ))}
                          </div>
                          <div className="claim-list">
                            {filtered.length === 0 && (
                              <div className="empty-state">
                                当前分类暂无主张
                              </div>
                            )}
                            {filtered.map((c) => (
                              <article key={c.id} className="claim-card">
                                <div className="claim-top">
                                  <span className="claim-id">{c.id}</span>
                                  <span className={"type-label " + c.kind}>
                                    {c.kind === "fact"
                                      ? "事实"
                                      : c.kind === "inference"
                                        ? "推断"
                                        : "不确定主张"}
                                  </span>
                                  <span className={"verdict " + c.verdict}>
                                    {c.verdict === "supported" ? (
                                      <Check size={13} />
                                    ) : c.verdict === "contradicted" ? (
                                      <X size={13} />
                                    ) : (
                                      <CircleAlert size={13} />
                                    )}{" "}
                                    {LABELS[c.verdict]}
                                  </span>
                                </div>
                                <h4>{c.text}</h4>
                                <p>{c.reason}</p>
                                <div className="evidence-links">
                                  {c.evidence_ids.map((id) => {
                                    const e = run.evidence.find(
                                      (e) => e.id === id,
                                    );
                                    return (
                                      e && (
                                        <button
                                          key={id}
                                          onClick={() => openEvidence(e)}
                                        >
                                          <Link2 size={12} />
                                          {id}
                                          <span>{e.label}</span>
                                          <ArrowUpRight size={12} />
                                        </button>
                                      )
                                    );
                                  })}
                                  {!c.evidence_ids.length && (
                                    <span className="evidence-gap">
                                      <CircleAlert size={12} />
                                      缺少事件原文与因果证据
                                    </span>
                                  )}
                                </div>
                                <div className="claim-review">
                                  <span
                                    className={
                                      c.review === "pending"
                                        ? "review-pending"
                                        : "review-done"
                                    }
                                  >
                                    {c.review === "pending" ? (
                                      <Clock3 size={13} />
                                    ) : (
                                      <CheckCheck size={13} />
                                    )}{" "}
                                    {LABELS[c.review]}
                                  </span>
                                  <div>
                                    <button
                                      className={
                                        c.review === "revision" ? "marked" : ""
                                      }
                                      onClick={() => review(c.id, "revision")}
                                    >
                                      需修订
                                    </button>
                                    <button
                                      className={
                                        c.review === "confirmed"
                                          ? "marked confirmed"
                                          : ""
                                      }
                                      onClick={() => review(c.id, "confirmed")}
                                    >
                                      <Check size={13} />
                                      确认核验记录
                                    </button>
                                  </div>
                                </div>
                                {c.review !== "pending" && (
                                  <textarea
                                    aria-label={`${c.id}复核备注`}
                                    className="review-note"
                                    placeholder="记录复核意见…"
                                    value={c.review_note}
                                    onChange={(e) =>
                                      updateNote(c.id, e.target.value)
                                    }
                                    onBlur={(e) =>
                                      review(c.id, c.review, e.target.value)
                                    }
                                  />
                                )}
                              </article>
                            ))}
                          </div>
                          <div className="panel-footer">
                            <ShieldCheck size={15} />
                            <span>人工复核确认记录，不改变核验结果。</span>
                          </div>
                        </section>
                        <aside className="evidence-column">
                          <section className="evidence-panel">
                            <div className="panel-heading">
                              <h3>证据概览</h3>
                            </div>
                            <div className="chart-header">
                              <span>前复权收盘走势</span>
                              <strong>
                                {fmt(
                                  run.evidence.find((e) => e.id === "E1")
                                    ?.value ?? null,
                                )}
                                <small>%</small>
                              </strong>
                            </div>
                            <Sparkline rows={run.series} />
                            <div className="chart-axis">
                              <span>{run.period.start || "未知"}</span>
                              <span>{run.period.end || "未知"}</span>
                            </div>
                            <div className="evidence-stat-list">
                              {run.evidence.slice(0, 5).map((e) => (
                                <button
                                  key={e.id}
                                  onClick={() => openEvidence(e)}
                                >
                                  <div>
                                    <span>{e.label}</span>
                                    <small>
                                      {e.id} · {LABELS[e.quality]}
                                    </small>
                                  </div>
                                  <strong
                                    className={
                                      e.quality !== "valid" ? "muted" : ""
                                    }
                                  >
                                    {fmt(e.value)}
                                    <small>{e.unit}</small>
                                  </strong>
                                  <ChevronRight size={14} />
                                </button>
                              ))}
                            </div>
                            <button
                              className="full-link"
                              onClick={() =>
                                run.evidence[0] && openEvidence(run.evidence[0])
                              }
                            >
                              查看完整证据
                              <ArrowRight size={14} />
                            </button>
                          </section>
                          <section className="source-panel">
                            <div className="panel-heading">
                              <h3>数据来源</h3>
                              <Database size={16} />
                            </div>
                            <div className="provider">
                              <span className="provider-logo">扶</span>
                              <div>
                                <strong>扶摇金融数据</strong>
                                <small>
                                  {
                                    run.sources.filter(
                                      (s) => s.provider === "扶摇" && s.ok,
                                    ).length
                                  }
                                  /5 项数据返回
                                </small>
                              </div>
                              <span
                                className={
                                  "status-dot " +
                                  (run.sources.filter(
                                    (s) => s.provider === "扶摇" && s.ok,
                                  ).length === 5
                                    ? "ok"
                                    : "warn")
                                }
                              />
                            </div>
                            <div className="provider">
                              <span className="provider-logo blue-logo">
                                iF
                              </span>
                              <div>
                                <strong>iFinD MCP</strong>
                                <small>
                                  {run.sources.find((s) => s.id === "ifind")?.ok
                                    ? "报价字段已返回"
                                    : "报价调用未成功"}
                                </small>
                              </div>
                              <span
                                className={
                                  "status-dot " +
                                  (run.sources.find((s) => s.id === "ifind")?.ok
                                    ? "ok"
                                    : "warn")
                                }
                              />
                            </div>
                            <div
                              className={
                                "crosscheck " +
                                (run.corroboration.status === "aligned"
                                  ? ""
                                  : "warn")
                              }
                            >
                              <ShieldCheck size={16} />
                              <p>{run.corroboration.message}</p>
                            </div>
                          </section>
                        </aside>
                      </div>
                      <details className="audit-panel">
                        <summary>
                          <Database size={18} />
                          <h3>数据与执行记录</h3>
                          <span>
                            {run.sources.length} 项凭证
                            {run.warnings.length > 0
                              ? ` · ${run.warnings.length} 项数据限制`
                              : ""}
                          </span>
                          <ChevronDown size={17} />
                        </summary>
                        <div className="audit-content">
                          <div className="audit-list">
                            {run.sources.map((s) => (
                              <button
                                key={s.id}
                                onClick={() => {
                                  const e =
                                    run.evidence.find((e) =>
                                      e.source_ids.includes(s.id),
                                    ) || run.evidence[0];
                                  if (e) {
                                    setDrawer(e);
                                    setActiveSource(s.id);
                                  }
                                }}
                              >
                                <span
                                  className={
                                    "audit-dot " + (s.ok ? "ok" : "warn")
                                  }
                                />
                                <div>
                                  <strong>{s.label}</strong>
                                  <small>
                                    {s.ok
                                      ? `源时点 ${s.data_at ? time(s.data_at) : "未知"}`
                                      : s.error}
                                  </small>
                                </div>
                                <span>
                                  {s.duration_ms
                                    ? `${(s.duration_ms / 1000).toFixed(1)}s`
                                    : "—"}
                                </span>
                                <ArrowUpRight size={13} />
                              </button>
                            ))}
                          </div>
                          {run.warnings.length > 0 && (
                            <details className="warnings">
                              <summary>
                                <CircleAlert size={14} />
                                {run.warnings.length} 项数据风险与限制
                              </summary>
                              <ul>
                                {run.warnings.map((w, i) => (
                                  <li key={i}>{w}</li>
                                ))}
                              </ul>
                            </details>
                          )}
                          <button
                            className="btn btn-light btn-small audit-export"
                            onClick={() => exportRun(true)}
                          >
                            <Code2 size={15} />
                            导出证据 JSON
                          </button>
                        </div>
                      </details>
                      <details className="lab-bar">
                        <summary>
                          <FlaskConical size={16} />
                          评审测试
                          <ChevronDown size={14} />
                        </summary>
                        <div>
                          <button onClick={() => fault("missing")}>
                            模拟接口失败
                          </button>
                          <button onClick={() => fault("conflict")}>
                            模拟两源冲突
                          </button>
                          <button onClick={() => fault("stale")}>
                            模拟过期数据
                          </button>
                          <button
                            onClick={() => {
                              setText("建议现在满仓买入，保证收益。");
                              setRun(null);
                              setPlan(null);
                              setToast("已填入边界输入；点击 AI 拆解验证拦截");
                            }}
                          >
                            测试合规拦截
                          </button>
                        </div>
                      </details>
                    </div>
                  )}
                </>
              )}
              {tab === "history" && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">RESEARCH LOG</div>
                      <h1>每一次复核，都有迹可循。</h1>
                      <p>
                        保存在当前浏览器的最近 8
                        条记录。原始响应、逐条结论和复核备注可一起导出。
                      </p>
                    </div>
                    <button className="btn btn-primary" onClick={newTask}>
                      <Plus size={16} />
                      新建核验
                    </button>
                  </div>
                  <div className="history-search">
                    <Search size={17} />
                    <input
                      aria-label="搜索记录"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="搜索证券代码或观点"
                    />
                  </div>
                  <section className="history-panel">
                    {history.filter((r) =>
                      (r.input.text + r.input.symbol).includes(search),
                    ).length === 0 ? (
                      <div className="empty-state">
                        <History size={28} />
                        <h3>这里等待你的第一条研究记录</h3>
                        <p>完成在线取证或复核示例后，记录会保存在此浏览器。</p>
                        <button
                          className="btn btn-light"
                          onClick={() => setTab("work")}
                        >
                          开始核验
                        </button>
                      </div>
                    ) : (
                      history
                        .filter((r) =>
                          (r.input.text + r.input.symbol).includes(search),
                        )
                        .map((r) => (
                          <button
                            className="history-row"
                            key={r.id}
                            onClick={() => {
                              setRun(r);
                              setText(r.input.text);
                              setSymbol(r.input.symbol);
                              setWindowDays(r.input.window);
                              setTab("work");
                              setPlan(null);
                            }}
                          >
                            <FileCheck2 size={22} />
                            <div>
                              <strong>
                                {r.input.text.slice(0, 55)}
                                {r.input.text.length > 55 ? "…" : ""}
                              </strong>
                              <small>
                                {r.input.symbol} · {fullTime(r.created_at)} ·{" "}
                                {r.mode === "live"
                                  ? "AI 在线取证"
                                  : r.mode === "live_fixed"
                                    ? "固定规划在线取证"
                                    : r.mode === "replay"
                                      ? "回放"
                                      : "故障演练"}
                              </small>
                            </div>
                            <span>
                              {
                                r.claims.filter((c) => c.review !== "pending")
                                  .length
                              }
                              /{r.claims.length} 已复核
                            </span>
                            <ArrowRight size={17} />
                          </button>
                        ))
                    )}
                  </section>
                  <div className="mode-notice">
                    <CircleAlert size={15} />
                    记录未同步到服务端；清理浏览器数据会删除本地记录。多人协作与不可篡改审计尚未实现。
                  </div>
                </>
              )}
              {tab === "method" && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">METHODOLOGY & BOUNDARIES</div>
                      <h1>AI 负责理解，证据负责约束。</h1>
                      <p>一个可以跑通、也可以被证伪的研究质量工作流。</p>
                    </div>
                  </div>
                  <div className="method-grid">
                    <section className="method-card">
                      <span className="icon-square">
                        <FileCheck2 size={21} />
                      </span>
                      <h2>为谁解决什么问题</h2>
                      <p>
                        面向每天写盘后观点的 A
                        股研究员与内容复核人。原始工作流是读行情 → 写观点 →
                        多页面核对数据 →
                        复核发布。证研把“已写出的观点”变成逐条核验任务。
                      </p>
                      <p>
                        <b>首要任务：</b>
                        在发出研究内容前，找出无法被数据支持的句子，保留原始证据与人工判断。
                      </p>
                      <p>
                        <b>非目标：</b>
                        荐股、预测、自动交易、全市场选股、多资产配置与投资适当性服务。
                      </p>
                    </section>
                    <section className="method-card">
                      <span className="icon-square">
                        <Sparkles size={21} />
                      </span>
                      <h2>为什么需要 LLM</h2>
                      <p>
                        LLM
                        将“跑赢”“放量”“政策催化”等自然语言拆成原文主张、指标与阈值，识别语义歧义和无法验证的因果。规则与传统终端通常要求用户预先选字段。
                      </p>
                      <p>
                        数值计算、时效性、字段校验和结论判定由确定性执行器完成。人工先确认计划，再复核记录。模型失效时流程停止，不伪装成
                        AI。
                      </p>
                    </section>
                    <section className="method-card">
                      <span className="icon-square">
                        <Database size={21} />
                      </span>
                      <h2>数据与统计口径</h2>
                      <p>
                        扶摇：交易日历、个股前复权日线、沪深 300 不复权日线、PE
                        TTM
                        和行情快照。iFinD：同日报价字段交叉检查。两个品牌可能共享上游，不能当作独立来源。
                      </p>
                      <p>
                        N 日涨跌幅需 N+1
                        根日线并按交易日历精确对齐。相对涨幅用百分点；成交额比用倍数；PE
                        不解释为历史低估。交易日 16:00
                        后要求当日完整日线，之前使用前一交易日。
                      </p>
                    </section>
                    <section className="method-card">
                      <span className="icon-square">
                        <ShieldCheck size={21} />
                      </span>
                      <h2>失效与合规控制</h2>
                      <p>
                        业务错误码、缺失日、重复日期、非正价格、空字段、过期、两源冲突都显式显示。未知不会被自动改为支持。政策因果没有原文证据时始终保留未知。
                      </p>
                      <p>
                        直接买卖建议、收益承诺和确定性未来涨跌在取数前拦截。当前规则覆盖有限，仍需人工审核；不接收账户、持仓等个人敏感信息。
                      </p>
                    </section>
                    <section className="method-card wide">
                      <span className="icon-square">
                        <FlaskConical size={21} />
                      </span>
                      <h2>怎么证明有价值</h2>
                      <div className="kpi-table">
                        <div>
                          <strong>待验证假设</strong>
                          <span>
                            核对一段 4 主张观点的中位耗时相对人工降低 ≥
                            40%；不能把预期写成已实现结果。
                          </span>
                        </div>
                        <div>
                          <strong>质量门槛</strong>
                          <span>
                            数值结论字段可追溯率
                            100%；对缺失/冲突/过期样本的静默正常结论数为
                            0；主张拆解准确率目标 ≥ 90%。
                          </span>
                        </div>
                        <div>
                          <strong>验证设计</strong>
                          <span>
                            招募 5 位研究员，用 30
                            段脱敏真实观点做配对交叉试验；人工与产品随机排序。记录完成时长、漏检、误报与人工修订原因。
                          </span>
                        </div>
                        <div>
                          <strong>当前证据</strong>
                          <span>
                            真实扶摇与 iFinD
                            调用、自动化边界测试、浏览器主链路测试。尚未开展用户访谈或上述对照试验，未宣称真实效率提升。
                          </span>
                        </div>
                        <div>
                          <strong>上线前还需</strong>
                          <span>
                            数据许可审查、持久化账户权限、分布式配额、完整文本安全评估、不可篡改审计、更多模型与多标的评测。当前为研究原型。
                          </span>
                        </div>
                      </div>
                      <p className="font-credit">
                        Display:{" "}
                        <a
                          href="https://www.onlinewebfonts.com/fonts"
                          target="_blank"
                          rel="noreferrer"
                        >
                          BubbledotICG-FinePos · Web Fonts · CC BY 4.0
                        </a>
                        ；Geist Pixel Circle · SIL OFL。
                      </p>
                    </section>
                  </div>
                </>
              )}
              <footer className="app-footer">
                <span>
                  <ShieldCheck size={13} />
                  研究辅助工具，不构成投资建议。
                </span>
                <span>证研 · Research Desk</span>
              </footer>
            </main>
          </div>
        </div>
      </div>
      {settings && (
        <div className="modal-backdrop" onClick={() => setSettings(false)}>
          <section
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <span className="icon-square">
                <Settings2 size={20} />
              </span>
              <h2 id="settings-title">连接设置</h2>
              <button onClick={() => setSettings(false)} aria-label="关闭设置">
                <X size={19} />
              </button>
            </div>
            <p className="muted">
              接入模型，核验你自己的观点。密钥仅在本页临时使用，刷新后清除。
            </p>
            <div className="connection-overview">
              <div>
                <Database size={17} />
                <span>扶摇</span>
                <b>{status.fuyao ? "服务端已配置" : "未配置"}</b>
              </div>
              <div>
                <Database size={17} />
                <span>iFinD</span>
                <b>{status.ifind ? "服务端已配置" : "未配置"}</b>
              </div>
              <div>
                <Sparkles size={17} />
                <span>默认模型</span>
                <b>{status.model ? status.model_name : "等待接入"}</b>
              </div>
            </div>
            <label className="form-label">
              模型服务
              <select
                value={llm.baseUrl}
                onChange={(e) => setLlm({ ...llm, baseUrl: e.target.value })}
              >
                <option value="https://api.openai.com/v1">OpenAI</option>
                <option value="https://api.deepseek.com/v1">
                  DeepSeek（兼容接口）
                </option>
                <option value="https://openrouter.ai/api/v1">
                  OpenRouter（兼容接口）
                </option>
                <option value="https://api.moonshot.cn/v1">
                  Moonshot（兼容接口）
                </option>
              </select>
            </label>
            <label className="form-label">
              模型名称
              <input
                value={llm.model}
                onChange={(e) => setLlm({ ...llm, model: e.target.value })}
                placeholder="填写你已开通的模型名称"
                autoComplete="off"
              />
            </label>
            <label className="form-label">
              API Key
              <input
                type="password"
                value={llm.apiKey}
                onChange={(e) => setLlm({ ...llm, apiKey: e.target.value })}
                placeholder="只保存在当前页面内存"
                autoComplete="off"
              />
            </label>
            <div className="settings-note">
              <CircleAlert size={16} />
              <p>没有模型密钥，也可以先体验固定示例的真实数据核验。</p>
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-light"
                onClick={() =>
                  setLlm({
                    baseUrl: "https://api.openai.com/v1",
                    model: "",
                    apiKey: "",
                  })
                }
              >
                清除临时配置
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setSettings(false);
                  setToast("本次页面的模型配置已保存");
                }}
              >
                保存本次配置
                <Check size={15} />
              </button>
            </div>
          </section>
        </div>
      )}
      {drawer && run && (
        <div className="drawer-backdrop" onClick={() => setDrawer(null)}>
          <aside
            className="evidence-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="evidence-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-heading">
              <div>
                <span className="eyebrow">EVIDENCE RECEIPT · {drawer.id}</span>
                <h2 id="evidence-title">{drawer.label}</h2>
              </div>
              <button onClick={() => setDrawer(null)} aria-label="关闭证据">
                <X size={21} />
              </button>
            </div>
            <div className="drawer-number">
              <strong>{fmt(drawer.value)}</strong>
              <span>{drawer.unit}</span>
              <span
                className={
                  "tag " + (drawer.quality === "valid" ? "green" : "amber")
                }
              >
                {LABELS[drawer.quality]}
              </span>
            </div>
            {drawer.reason && (
              <div className="drawer-reason">{drawer.reason}</div>
            )}
            <h3>计算与统计口径</h3>
            <p>{drawer.formula}</p>
            <h3>原始字段路径</h3>
            {drawer.fields.map((f) => (
              <code className="field-path" key={f}>
                {f}
              </code>
            ))}
            <h3>来源凭证</h3>
            <div className="source-tabs">
              {run.sources
                .filter(
                  (s) =>
                    drawer.source_ids.includes(s.id) || s.id === activeSource,
                )
                .map((s) => (
                  <button
                    key={s.id}
                    className={activeSource === s.id ? "selected" : ""}
                    onClick={() => setActiveSource(s.id)}
                  >
                    {s.provider} · {s.label}
                  </button>
                ))}
            </div>
            {(() => {
              const s = run.sources.find((s) => s.id === activeSource);
              return (
                s && (
                  <>
                    <dl className="source-details">
                      <dt>服务</dt>
                      <dd>{s.provider}</dd>
                      <dt>数据时点</dt>
                      <dd>
                        {typeof s.data_at === "number"
                          ? fullTime(s.data_at)
                          : s.data_at || "未知"}{" "}
                        CST
                      </dd>
                      <dt>抓取时间</dt>
                      <dd>{fullTime(s.fetched_at)} CST</dd>
                      <dt>请求标识</dt>
                      <dd>{s.request_id || "服务未提供"}</dd>
                      <dt>调用状态</dt>
                      <dd>{s.ok ? "成功" : s.error}</dd>
                      <dt>请求地址</dt>
                      <dd className="url-text">{s.url}</dd>
                    </dl>
                    <h3>原始响应</h3>
                    <pre className="raw-json">
                      {JSON.stringify(s.raw || { error: s.error }, null, 2)}
                    </pre>
                  </>
                )
              );
            })()}
            <p className="drawer-footnote">
              展示保留两位小数，判定使用原始精度。时区：Asia/Shanghai。
            </p>
          </aside>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
