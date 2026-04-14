type ThemeModeScriptProps = {
  defaultMode: "dark" | "light";
};

const THEME_STORAGE_KEY = "pcgs_theme_mode";

export function ThemeModeScript({ defaultMode }: ThemeModeScriptProps) {
  const script = `
    (function () {
      try {
        var storageKey = "${THEME_STORAGE_KEY}";
        var stored = window.localStorage.getItem(storageKey);
        var mode = stored === "light" || stored === "dark" ? stored : "${defaultMode}";
        var body = document.body;
        if (!body) return;
        body.classList.remove("theme-dark", "theme-light");
        body.classList.add(mode === "light" ? "theme-light" : "theme-dark");
      } catch (error) {
        // Ignore storage access issues and keep server-rendered class.
      }
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
