(function () {
    const btn = document.createElement("a");
    btn.href = "../web-app/menu.html";
    btn.textContent = "← Menu";
    btn.style.cssText = [
        "background: rgba(42, 63, 92, 0.85)",
        "border-radius: 8px",
        "bottom: 1.2rem",
        "color: #f4f0e8",
        "font-family: Cinzel, Georgia, serif",
        "font-size: 0.8rem",
        "font-weight: 600",
        "letter-spacing: 0.08em",
        "padding: 0.5rem 1rem",
        "position: fixed",
        "right: 1.2rem",
        "text-decoration: none",
        "transition: background 0.15s",
        "z-index: 9999"
    ].join(";");
    btn.onmouseenter = function () {
        btn.style.background = "rgba(42, 63, 92, 0.98)";
    };
    btn.onmouseleave = function () {
        btn.style.background = "rgba(42, 63, 92, 0.85)";
    };
    document.body.appendChild(btn);
}());
