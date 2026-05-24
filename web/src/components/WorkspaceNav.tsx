import { Link } from "react-router-dom";
import { Pencil, GitCompare } from "lucide-react";

const links = [
  { label: "数据标注", href: "/annotation.html", icon: Pencil },
  { label: "算法对比", href: "/training", icon: GitCompare },
];

export default function WorkspaceNav() {
  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-outline-variant shadow-sm">
      <div className="max-w-[1800px] mx-auto px-5 h-12 flex items-center gap-6">
        <span className="font-bold text-body text-primary tracking-tight shrink-0">长明灯</span>
        <div className="flex items-center gap-1">
          {links.map(({ label, href, icon: Icon }) => {
            const active = window.location.pathname.endsWith(href.replace('.html', ''));
            return (
              <Link key={href} to={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-caption font-semibold transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}>
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
